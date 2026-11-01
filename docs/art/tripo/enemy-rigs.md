# Enemy rigs (Nov 1, 2026): the batch-2 humanoid enemies walk with their arms

The model-quality sweep (`docs/art/tripo/model-quality.md`, "Found in the sweep") found that the batch-2 humanoid
enemies were fitted by the same `tools/tripo/tripolib/autorig.py` as Luna and had the same fault: arms on the wrong
bones, some arm bones with no vertices, so they walked with stiff arms out. This re-rigs them, and the two titans
the sweep had not listed. Branch `fix/enemy-rigs` off `fix/model-quality` `8150319b`. Display only: no sim data
changes, the sim id is unchanged (`e3c222f3ad44`), no `COOP_PROTOCOL` bump.

Board: `docs/art/previews/enemy-rigs-board.jpg` (before / after in a real battle, 1-1, at 1280x720 and 390x844:
each enemy's walk, and its special after).

## Tripo credits

**None spent.** No Tripo task was created (no mesh was unsalvageable: every fix was a rig, weights and clips on the
shipped mesh), so there are no task ids. The balance read 305 on Nov 1, the same as at the end of the model-quality
fix.

## Diagnosis (before)

`autorig.py` assumes a T-pose: the arm line is the widest slice of the figure between 41 and 60 % of its height, and
the bones run along it horizontally. These enemies stand in an **A-pose** (arms 35 to 70 degrees below the
horizontal), so the line ran through whatever was widest at that height, and bone heat then gave the real arms,
hanging below it, to the nearest other bones. Measured from the shipped files (dominant bone per vertex, front / side
/ top views by `tools/tripo/landmark_views.py`):

| enemy | where the autorig put the arm line | what carried the arms |
|---|---|---|
| `orc_grunt` | 56 % (shoulder pads, club head) | both arms on the **head** bone (2,837 of 6,571 vertices), the pads and upper arms on the shoulder bones; left forearm and hand bones and the right upper arm and forearm empty |
| `oni_brute` | 58 % (horns, club) | arms and the club on the **head** (3,198 of 5,737); right upper arm, forearm and hand bones empty |
| `fp_hyakki_daimyo` | 60 % (its parade **banner**) | arms on the **thigh** bones (4,614 / 4,659 vertices), the banner on the head; arm bones 0.5 % of the mesh |
| `goblin_runner` | 42 % (the hands) | forearms and hands bound; upper arms on the head (11 and 13 vertices on the upper-arm bones) |
| `ghoul_bonewalker` | 46 % | forearms and hands bound; upper arms under the poncho on the head and chest (7 and 10) |
| `lizard_skink` | 42 % | upper arms 10 and 61 vertices; the tail rigid on the hips |
| `iron_colossus` (not in the sweep's list) | 42 % (the fists) | shoulders, crystal pauldrons and upper arms on the **head** (9,108 of 14,126: the whole torso); hand bones 2 and 3 vertices |
| `fp_foundry_titan` (not in the sweep's list) | 42 % | the same: head 14,040 of 21,085; hand bones 21 and 32 |

The clips (`clips_enemy.HumanoidClips`, written for a T-pose rest) lowered and swung bones that carried nothing:
the arms stood where the download left them while the legs walked. A side effect: the head slot of
`src/models/glbEnemy.js` (event hats) is built from the vertices the head bone dominates, which on the Orc, the Oni
and the titans included the arms or the whole body.

## What changed

All rebuilt from their own shipped files (`git show 8150319b:public/models/enemies/tripo/<id>.glb`, and the
`.lod.glb` of the five family enemies, each from itself: no second decimation). The mesh and UVs are the shipped ones
(the same triangles, packed the same way) and the base-colour WebP is kept byte for byte (transplanted back after
packing). Triangle counts are unchanged; welding the UV-seam splits before fitting dropped 6 exactly duplicated
vertices of the Daimyo (22,654 to 22,648). The build is deterministic: running it again writes the same bytes.

* `tools/tripo/rerig_tripo_enemy.py`: the per-enemy profiles (`ENEMIES`, read off the landmark views with a 0.05
  grid in the 1 m frame) and the build: import, weld the UV-seam splits, fit, skin, clips, pack, texture transplant,
  `glbcompact`, manifest.
* `tools/tripo/tripolib/rerig_enemy.py`: a rig fitted to the **A-pose**: each arm's bones run shoulder, elbow, wrist,
  fingertip along the real arm (the arm points' depth and the elbow / wrist centring refined from the arm's own
  vertices), legs over the middle of each foot (measured), the same bone names as before (so `glbEnemy` slots keep
  working), plus a **tail chain** (Skink, 4 bones) and a **banner chain** (Daimyo, 2 bones off the chest). Weights
  are geometric, not bone heat (heat bled the A-pose arms into the bodies): torso by height with soft ramps, each arm
  an elliptical tube seen from the front (radius across, a half depth), weighted along the chain with blends at the
  elbow and wrist; legs by side, with armour skirts, coats and rags mostly on the hips; clubs **and the fists around
  them** wholly on their hand (the Orc's in the right, the Oni's in the left); the titans' pauldrons on the clavicles
  and the Foundry Titan's chimneys on the chest; a few Laplacian passes soften the cuts.
* `tools/tripo/tripolib/clips_brute.py`: new clips at the lengths `glbEnemy` and `tests/models/tripo.test.js` expect
  (move 1.0, idle 1.5, hit 0.3, death 0.8, special 0.6 s). The arms are set by a target hang angle from the A-pose,
  never through a T. Builds: a rolling stomp (Orc, Oni), the same slower with the banner swaying (Daimyo), a machine
  stomp with a jolt on landing (Colossus, Titan), a scamper with pumping elbows (Goblin), a rattling shuffle with arms
  out in front (Bonewalker), a waddle with the tail swinging (Skink). Specials: the Orc swings its club up until it
  stands and thumps it down; the Oni hoists its upright club and pounds it down; the Daimyo flings its arms up with the
  banner waving (it loops while its field is up); the Goblin crouches and hops; the Bonewalker rattles a "boo"; the
  Skink whips its tail; the titans raise both fists (pauldrons riding up) and slam them down. The death buckles the
  knees and topples it onto its back (no gore; the battle shrinks and fades it). A weapon hand keeps the club as the
  figure holds it when the arm comes down from the A-pose.
* `tools/tripo/tripolib/glbcompact.py`: the new clips animate more bones, and `pack.py` keeps a moving bone's channel
  in every clip and one bufferView per accessor: the JSON chunk grew from 24 to 42 KB and the Bonewalker's light file
  went over its 160 KB budget. Per clip, channels that hold the rest value are dropped (three.js fills a bone a
  playing clip has no track for with its rest value), equal key-time arrays are shared and the animation data is one
  bufferView. Every file is now within 3 KB of its batch-2 size (the Skink 8 KB: its tail chain animates).
* `tools/tripo/landmark_views.py` (new): front / side / top / back of a GLB in the 1 m frame with a 0.05 grid, and the
  same coloured by dominant bone (a fixed colour per bone name): the views the landmarks are read from and the weights
  are checked on.
* `tools/tripo/clip_strips.py`: several GLBs at once, `--margin` (an enemy's raised club or its fall), `--yaw`.

| file | before | after |
|---|---|---|
| `orc_grunt` / `.lod` | 253,280 / 137,292 B | 253,828 / 138,296 B |
| `oni_brute` / `.lod` | 254,728 / 134,432 B | 256,392 / 136,168 B |
| `fp_hyakki_daimyo` | 926,356 B | 928,860 B |
| `goblin_runner` / `.lod` | 222,004 / 121,076 B | 220,940 / 120,796 B |
| `ghoul_bonewalker` / `.lod` | 284,664 / 150,872 B | 284,612 / 151,040 B |
| `lizard_skink` / `.lod` | 188,832 / 105,228 B | 196,784 / 113,132 B |
| `iron_colossus` | 605,096 B | 604,860 B |
| `fp_foundry_titan` | 835,120 B | 835,220 B |

## The render-and-look loop

`tools/tripo/clip_strips.py` rendered every clip of every enemy as 10 frames from the battle camera (48 degrees down,
a quarter turn), plus front and side strips where a pose needed a closer look; each round was read, fixed and
rendered again. What the loop caught and fixed:

* The first weights left the outer half of the Orc's and Oni's thick arms and sleeves on the torso (the arm capsule
  was too thin front to back): the arm region became an elliptical tube seen from the front.
* The Orc's club top sat outside its capsule (its axis was read 6 cm off): the top stayed on the chest. The axis was
  re-read off the top view.
* Lowering an arm from the A-pose rolled a held club outward with it (the Oni's club leaned 18 degrees): the weapon
  hand undoes that roll.
* The Oni's first special (an overhead chop) flipped its upright club upside down, and aiming the club through the
  swing needed the wrist to turn past the forearm: the fist crumpled. It became a hoist-and-pound that keeps the club
  upright, half aimed while hoisted; the fists around both clubs are rigid on the hand.
* Elbow bends past 50 degrees crumpled the Oni's stubby forearms; the free fist pump crossed its face from the battle
  camera: smaller bends, the pump goes out to the side.
* The Orc's thump bowed its head so far the camera saw only its top knot; the Bonewalker's "boo" covered its skull with
  its arms: chins kept up, arms raised out to the sides.
* The Daimyo's helmet sheared: the banner region took the back of the helmet and the horn tips, and tilting the chin
  up pushed the helmet into the banner. The banner region starts behind the helmet, and the Daimyo leans its whole
  upper body back a little (so the mask under the helmet brim reads from above) instead of tilting its head.
* The Skink's tail whip curled its tail into a hook (each segment adding 38 degrees): halved.
* The titans' raised fists passed through their pauldrons: the clavicles lift with the fists.
* In the battle close-ups (the e2e at 390x844 and 1280x720) the Oni's hoisted club fist crossed its face from one
  camera side: the club arm rolls further out, so the fist rises beside the head (seen from its left, as in the
  1280x720 close-up, it still reaches the cheek; the eyes, horns and grin read).

## The sweep (every other enemy GLB)

* Fixed here (same autorig fault): the six listed plus `iron_colossus` and `fp_foundry_titan`.
* Fine: `brigade_trooper`, `brigade_shieldline` (batch 1, Tripo's own biped rig: arms bound, hanging, every clip moves
  them); `slime_green` (the Blender build of the model-quality fix).
* Rigid by design, one `body` bone, nothing to bind (not this fault): `beast_wolf`, `construct_cogling`,
  `brigade_badger`, `brigade_tortoise` (vehicle), `brigade_gnat`, `ghost_wisp`, `fae_sprite`, `dragon_wyvern`,
  `dragon_ashwing`, `fp_eclipse_wyrm`, `fp_gloom_regent` (hover), `plant_sprout` (blob). Of these the fairy and the
  Gloom Regent have arms and the dragons wings that never move on their own (batch 2 already listed "no wing flaps"):
  a rigged pass for them would be its own job.
* The twelve family meshes (`public/models/enemies/*.glb`, built in Blender by `tools/blender/enemies/`): authored
  rigs, every deform bone carries vertices, their clips move the arms. Not affected.

## Checks

* `tests/models/modelQuality.test.js` (extended; the arm table is `tests/models/enemyArms.js`): for each re-rigged
  enemy, full and light file, where its arms **really are** (shoulder, elbow, wrist and fingertip of the mesh, not
  the file's bones): the upper arm, forearm and hand are each over 60 % on that side's arm bones; each hand's skinned
  vertices travel over 2.5 % of the height in the walk; the head bone's lowest vertices are at the neck (the head slot
  is the head); a club rides its hand; every clip moves the mesh; the death ends with the head below 45 % of its
  height; under 1 MB. On the batch-2 files every one of the 13 fails (on the arm check: 0 to 21 % of the arm on its
  bones).
* `e2e/model-quality.mjs` (extended): battle 1-1 at 390x844 and 1280x720 (quality high) and the light files at
  medium: each enemy alone on the road wearing its own model, its animator stepped by hand: the arm mesh on the arm
  bones, the hands swinging in the walk and the special; `--shots` saves the close-ups the board is made from;
  `--no-heroes` runs only the enemies. On the batch-2 files it fails.

Results (Nov 1, on this branch): `npm test` 6,956 passed / 11 skipped / 0 failed (the 13 new enemy checks among
them); sim id `e3c222f3ad44`, the same as `fix/model-quality` `8150319b` (no `COOP_PROTOCOL` bump);
`e2e/model-quality.mjs --no-heroes` 235 checks ok (every enemy at 390x844 and 1280x720, the five light files at
medium; on the batch-2 files the same run gives 77 failures: arm shares of 0 to 36 %, the Orc's, Oni's and Foundry
Titan's hands swinging 1 to 2 % of the height); the hero half (`--enemies none`) 122 checks ok, as on
`fix/model-quality`; `e2e/tripo-batch2.mjs` 34 ok and `e2e/tripo-batch1.mjs` 15 ok; `e2e/smoke.mjs` 678 ok and 2 failures, both in the known-flaky "SSR Select Ticket" step (at 844x390 "luna joined
and the ticket was used", at 390x844 "the picker lists an SSR the player does not own"; a UI timing issue in the
select-ticket picker, not the models).

## How to rebuild

```
blender -b --python-use-system-env --python tools/tripo/rerig_tripo_enemy.py -- --id all      # or --id orc_grunt,oni_brute
blender -b --python-use-system-env --python tools/tripo/rerig_tripo_enemy.py -- --id orc_grunt --preview /tmp/pv --preview-only
blender -b --python-use-system-env --python tools/tripo/landmark_views.py -- --glb public/models/enemies/tripo/orc_grunt.glb --out /tmp/views
blender -b --python-use-system-env --python tools/tripo/clip_strips.py -- --glb public/models/enemies/tripo/orc_grunt.glb --out /tmp/strips/ --margin 1.4
node e2e/model-quality.mjs --no-heroes --shots /tmp/er --tag after
```

Blender's own Python needs Pillow for the sheets (`<blender>/python/bin/python3 -m pip install --target <dir> Pillow`,
then `PYTHONPATH=<dir>`), as in `docs/art/tripo/model-quality.md`.
