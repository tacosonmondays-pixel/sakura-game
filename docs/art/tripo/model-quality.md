# Model quality fix (Oct 31, 2026): Luna's T-pose and the Green Slime

The owner: the regular slime "looks really bad", and Luna is "stuck T-posing without much animation". This fixes
both, then sweeps every girl and every one-enemy model for the same faults. Branch `fix/model-quality` off `main`
`a3d97a38`. Display only: no sim data changes, the sim id is unchanged, no `COOP_PROTOCOL` bump.

Board: `docs/art/previews/model-quality-board.jpg` (before / after in a real battle at 390x844 and 1280x720:
idle, move, attack and the slime's hop, hit and special).

## Tripo credits

**None spent.** Balance 365 before and after (`GET /v2/openapi/user/balance`). No task was created, so there are no
task ids to log. Both fixes were better done in Blender: Luna needed her own bones placed right (a tail and a staff
that Tripo's biped rig would not animate), and the slime is a simple shape that a clean build from the game's own
slime art matches better than another generation (the batch-2 download's faults were Tripo artefacts: a flat ring
and a slab through the ball).

About Mixamo-style rigs (owner's question): Tripo's `animate_rig` does offer `spec: "mixamo"` (standard humanoid
bone names). It was not used here (no Tripo rig was needed), but the rebuilt rigs keep a standard humanoid
hierarchy (hips, spine, chest, neck, head, shoulder / upper arm / forearm / hand, thigh / shin / foot / toe) and
`tools/tripo/tripolib/rerig.py` `MIXAMO_NAMES` maps every game bone to its Mixamo name, so stock humanoid clips can
be retargeted onto these girls later in Blender. Mixamo itself has no API and needs the owner's login, so nothing
was automated; see "Mixamo clips that would help" below.

## Diagnosis (before)

Measured in a real battle (`e2e/model-quality.mjs`) and from the files through the game's own loaders
(`e2e/model-audit.mjs`, all 118 character files, full and LOD), plus Blender renders of each rig by dominant bone.

### Luna (and the other batch-2 heroes): the automatic rig was fitted to the wrong places

Not a binding or loader fault: every clip binds (0 unbound tracks), the names `glbChibi.js` asks for exist
(`idle walk attack_cast cheer hurt`, `victory` / `pickup` fall back to `cheer`), the LOD file has the same skin and
clips, and the mixer runs. The clips even rotate her arm bones 62 degrees down. The mesh just was not on those bones:

* `tools/tripo/tripolib/autorig.py` takes the arm line as the widest slice of the figure between 41 and 60 % of
  her height. On Luna that slice is her **fox tail**, so the hand bones were put on the tail tips (x = +-0.45 in
  the 1 m frame; her real hands are at +-0.27) and the "shoulder" bone ran from the neck to past her real hands.
* So her whole arms were on the unanimated shoulder bones (761 and 788 vertices), her **staff on the head bone**,
  her tail on the left thigh bone; the arm bones carried 2.9 % of the mesh, the forearms and hands nothing.
  Whatever the clips did, the arms stayed straight out: a T-pose.
* Her idle moved 3 degrees (spine 1.5, head 2, arms 3): at most 2.3 % of her height. "Without much animation".

The same fault, milder, on the other three website heroes fitted by the same code:

| figure | what the autorig did | idle travel |
|---|---|---|
| Luna | arm line on the tail; arms on shoulder bones, staff on the head, tail on a thigh | 2.3 % |
| Nami | left forearm and hand bones empty (0 vertices), the trident on the head bone | 2.3 % |
| Kanna | shoulder joint halfway down the arm (her twin tails made the "torso" column tall): upper arms on the unanimated shoulder bones, only the forearms drooped | 2.4 % |
| Yoriko | same as Kanna (the coat), right hand bone empty | 2.3 % |
| Kogane, Norika (batch 1, Tripo's own rig) | arms bound fine (A-pose rest) | 3.2 %, 4.0 % |

Everything else is fine: the 29 Blender girls and their 18 `sentinel-` / `future-` variants (idle 6-9 %, every
clip binds and moves; their `hurt` / `victory` are held poses by design), and the seven Meshy figures (Hikari,
Hana, Noa, Ruri, Kohaku, Tsubaki, Tenka: idle 4.6-8.5 %, arms bound, no T-pose).

### The Green Slime: a broken website download

`slime_green` is the only slime with a model of its own (`TRIPO_ENEMIES`; the other slimes use the family mesh).
Batch 2 took it from the owner's website download "cute slime 3d model (3).glb". In Blender it is a lumpy, dull
dark-green ball cut by a **flat ring around it and a slab through its middle**, two holes in the sides, and the
face painted on the front **and again on the back**. One rigid bone, a flat 3-step toon material. From the battle
camera (above, at 48 degrees) it read as a dark green clam or macaron with a seam, not a jelly.

## What changed

### Heroes: re-rigged from their own shipped files

`tools/tripo/rerig_tripo_chibi.py` (run with Blender 5.2 or the bpy 4.2 module) rebuilds Luna, Nami, Kanna and
Yoriko from their batch-2 files (`git show a3d97a38:public/models/characters/<id>.glb`, full and LOD each from
itself, so no second decimation; the raw downloads are not in git). Mesh, UVs and the base-colour WebP stay byte
for byte (the texture is transplanted back after packing).

* `tools/tripo/tripolib/rerig.py`: the rig fitted from a per-figure profile (`FIGURES`: arm line, shoulder joint,
  hands, measured on front / side / top renders with a 0.05 grid in the 1 m frame), same bone names as before
  (clips, Yoriko's doll on `hand_L` and the tests keep working), plus **tail bones** for Luna and **twin-tail
  bones** for Kanna. Weights: bone heat on the welded mesh, then region rules: props wholly on their hand (Luna's
  staff, Nami's trident, Yoriko's control bar), the tail on the tail bones, arm weights only inside the arm tube,
  then a few Laplacian smoothing passes so the cuts do not crease.
* `tools/tripo/tripolib/clips_hero.py`: new clips. The free arm hangs (74-78 degrees down from the T, soft elbow)
  and swings; the arm that holds a prop is placed by **two-bone IK** at grip height with the prop kept upright, so
  the staff / trident stays planted beside her instead of swinging into the ground; idle breathes and sways (chest,
  head tilt and nod on offset phases), the tail wags and Kanna's twin tails sway; walk, cheer (arms come up in
  front, never out through the T), hurt and per-figure attacks (Luna: staff raised overhead, then swept forward at
  the road; Nami: trident drawn back and jabbed forward; Kanna: both arms up and down on the drum; Yoriko: a
  control-bar flick and a point). Chins a little higher (13-16 degrees) so the faces read from the 48-degree
  battle camera.
* Kogane and Norika (batch 1) keep Tripo's own rig and weights (`keep_rig`): their arms were bound well but rested
  almost straight out (Norika 9, Kogane 19 degrees down) and the batch-1 clips lowered them only 38 degrees more,
  with an idle that moved 3 degrees. All five clips are authored again on the same rig (clavicles dropped too,
  arms near 70 degrees down; their wrench swing and STOP-paddle push kept from batch 1).
* `src/models/glbChibi.js`: while an attack (or a companion's 'appear') fades in over its first 0.06 s, the idle
  under it now gives way only as fast as the attack comes in. Before, the idle dropped to 25 % at once while the
  attack started from 0, and three.js blends the missing weight toward the bind pose: a two-frame flash of the
  T-pose at the start of every attack on figures that rest in one (display only; Blender girls are unaffected).
* `tools/tripo/tripolib/compat.py`: Blender 4.2 / 5.x action API shim (5.0 dropped `Action.fcurves`) and the
  texture transplant. `autorig.py` now documents the failure and points here.

### The Green Slime: rebuilt in Blender after the game's own slime art

`tools/blender/enemies/build_slime_green.py` builds it from scratch after the "Hi!" sticker
(`public/art/stickers/slime_hi-256.webp`): a soft mochi dome (two superellipse halves, flat bottom, round crown),
mint green with a paler glowing hem, big glossy eyes with two highlights and a blue glint each, pink blush, a small
open smile with a tongue, and a sakura petal on its crown. Rig `root -> body -> top` (the body squashes from the
floor up, the top lags and wobbles). Clips: move (anticipation squash, stretch launch, a hop of a quarter of its
height, landing splat, jiggle settle), idle (breathing squash and a lazy wobble), hit, death (melts flat), special
(a happy jump spin). Full 4,576 triangles / 512 px texture, 108 KB; LOD 1,184 / 256 px, 42 KB (were 188 KB / 90 KB).

`src/models/glbEnemy.js`: a `look: 'jelly'` asset extra gives the textured toon body a soft pale rim and a crisp toon
highlight from a fixed key, so it reads glossy from whichever side it walks; status tints, hit flashes and outlines
work as before. `source: 'blender'` in its manifest entry and extras (`tests/models/tripo.test.js` knows).

Event hats come back too: `top` is the blob families' head slot (`glbEnemy.js` `SLOT_BONES`). The batch-2 model had
only a `body` bone, so on the Halloween stages a Green Slime lost its witch / pumpkin hat the moment its own model
replaced the family placeholder. On `ev-halloween-1` 5 of 8 Green Slimes now wear one (1 in 7 goes plain by design).

## The render-and-look loop

Every clip was rendered and looked at, then fixed and rendered again (owner, Nov 1):
`tools/tripo/clip_strips.py` renders each clip of a shipped GLB at 10 evenly spaced times from the battle camera's
angle (48 degrees down, a quarter turn), one row per clip. Looked for: does the pose read, feet planted, no T-pose
frame, no candy-wrapped wrist or shoulder, nothing through the skirt or hair. What the first pass caught and was
fixed:

* Luna's tail folded into a ball in her attack and cheer (three segments each bending 20 degrees and more): the
  wag is smaller and grows only 15 % per segment.
* Luna's staff and Nami's trident tipped the wrong way on the strike (head back, butt end at the road): the prop now
  swings its head forward at the road.
* Kanna's and Yoriko's strikes bowed the head so far that the battle camera saw only hair: smaller bows.
* Kanna's, Yoriko's and Nami's cheer raised the free arm out through a sideways T: the arms now come up in front.
* Kanna's sleeves left black spikes at the shoulders where a twin-tail rule caught the back of the sleeve; then her
  twin tails stretched where they pass behind the arms: they got their own bones (bone heat sorts them from the
  arms) and sway.
* Norika's arms still stood out (her rest pose is near a T): the clavicles drop too.
* In game, a T-pose flash at the start of each attack (the blend above), and the close-ups in the e2e are taken
  with the battle paused so an attack does not play over the clip being shown.

## Ready-made animation (licences checked Nov 1)

| source | licence (where checked) | used | notes |
|---|---|---|---|
| Quaternius, Universal Animation Library (Standard, v3.0) | CC0 1.0 (`License.txt` in the pack; itch.io "Asset license: Creative Commons Zero v1.0 Universal") | tried, not shipped | free ("name your own price"), 43 clips with UE-style bone names (`Idle_Loop`, `Walk_Loop`, `Spell_Simple_Shoot`, `Dance_Loop`, `Hit_Chest`, ...). Retargeted onto Luna (`tools/tripo/tripolib/retarget_ual.py`, `rerig_tripo_chibi.py --ual <glb>`): animation data only, its mannequin mesh is deleted on import and nothing of the pack is in git |
| Kenney animated character packs | CC0 1.0 (kenney.nl pack pages) | no | small generic sets |
| CMU Graphics Lab Motion Capture Database | the live FAQ did not answer (HTTP 503); secondary copies quote "free for use in research and commercial projects", no reselling of the data, NSF credit requested; some converted copies are CC BY-NC | no | check the live FAQ before any use |
| 100STYLE (Ian Mason) | CC BY 4.0 (ianxmason.com/100style); credit "The 100STYLE Dataset - Ian Mason" | no | stylised locomotion (BVH, 60 fps); no casts or cheers |
| Bandai Namco Research motion dataset | CC BY-NC 4.0 | avoided | non-commercial |
| Mixamo | Adobe account terms | no | needs the owner's login; no API |

Side by side (`docs/art/previews/model-quality-stock-vs-authored.jpg`, same figure, same battle-camera strips): the
library's adult clips turn Luna's body about 45 degrees and bow her head, so from the battle camera her face is
gone, and they swing the staff off its grip; on a chibi (head half her height, short arms) they would need hand
cleanup clip by clip. The authored chibi clips read better and ship. No third-party motion is in the game, so no
credit line is needed. The retarget path stays for later: it works for any T-pose-relative humanoid source
(world-axis deltas, `MAP` from the library's bone names to the game's), Mixamo FBX included.

### Mixamo clips that would help (if the owner wants them later)

Download with "Without Skin" checked, FBX, 30 fps, "In Place" where offered (names as Mixamo's search lists them;
pick the closest if one is renamed); they map through `MIXAMO_NAMES` (rename `MAP` in `retarget_ual.py`):

* Idle: "Happy Idle", "Breathing Idle"
* Walk: "Walking" (In Place)
* Cast: "Standing 1H Magic Attack 01" (Luna, Yoriko), "Standing 2H Magic Attack 01"
* Melee: "Standing Melee Attack Downward" (Kanna), "Standing Melee Attack Horizontal" (Nami, Kogane)
* Cheer: "Cheering", "Victory Idle"
* Hurt: "Hit Reaction"

Animation-only clips; no character meshes. Expect the same cleanup as above.

### Video to motion (report only, not built)

The owner could act a move out on a phone and have it on a girl: MediaPipe Pose (Apache 2.0) gives 33 body
landmarks per frame in 3D from an ordinary video. A Blender-side importer would turn each frame's bone directions
(shoulder to elbow to wrist, hip to knee to ankle, the spine from the hip and shoulder midpoints, the head from the
face points) into world rotations from a T-pose calibration frame, the same world-delta method as
`retarget_ual.py`, then key them on the game rig. It needs a smoothing filter (landmarks jitter), foot locking,
hand and head twist from extra points, and the chibi cleanup above. About a day or two of work plus a short
recording guide (side light, full body in frame, a T-pose first).

## Checks

* `tests/models/modelQuality.test.js` (new, from the GLB data): each re-rigged hero's arm bones carry the arms; at
  rest she is in the T-pose and at every quarter of the idle her free arm's bones hang over 50 degrees below the
  shoulder line and the **skinned mesh** follows (upper arm and hand vertices come down); every clip moves a hand
  or the head by a visible amount. The slime has the jelly look, the `body` / `top` rig, and a hop that squashes
  under 0.85, stretches over 1.12 and leaves the ground. On the batch-2 files every one of these fails.
* `e2e/model-quality.mjs` (new): battle 1-1 with each Tripo hero at 390x844 and 1280x720 (quality high) and the
  LOD at medium: her animator stepped by hand (frame-rate independent), how far the skinned mesh around her free
  hand comes down in idle (arm lengths) and the vertex travel of every clip; the Green Slime's squash range and
  material; the event hats on `ev-halloween-1`; no console errors. `--shots` saves the close-ups the board is made
  from; `--busy` measures 40 Green Slimes on the road (frame time, calls, triangles).
* `e2e/model-audit.mjs` (new): every character file through `glbChibi.js` (arm share, every clip's travel, unbound
  tracks, missing clip names).
* `tools/tripo/clip_strips.py` (new): the strips of the render-and-look loop.

## Found in the sweep, not fixed here

The batch-2 humanoid **enemies** were fitted by the same `autorig.py` and show the same fault: `orc_grunt` (left
forearm and hand bones empty, right upper arm and forearm empty), `oni_brute` (right arm bones empty),
`fp_hyakki_daimyo` (arms almost wholly on the shoulder bones), and partly `goblin_runner`, `ghoul_bonewalker` and
`lizard_skink` (upper arms carry 7-13 vertices). They walk with arms out. The fix is the same tool with an enemy
profile and `HumanoidClips` (move / idle / hit / death / special); left for its own pass.

## How to rebuild

```
blender -b --python-use-system-env --python tools/tripo/rerig_tripo_chibi.py -- --id luna   # nami kanna yoriko kogane norika
blender -b --python-use-system-env --python tools/tripo/rerig_tripo_chibi.py -- --id luna --preview /tmp/pv --preview-only
blender -b --python-use-system-env --python tools/tripo/clip_strips.py -- --glb public/models/characters/luna.glb --out /tmp/luna.png
blender -b --python-use-system-env --python tools/blender/enemies/build_slime_green.py
node e2e/model-quality.mjs --shots /tmp/mq --heroes luna,nami,kanna,yoriko,kogane,norika
node e2e/model-audit.mjs
```

Blender's own Python needs Pillow for the packing step (`<blender>/python/bin/python3 -m pip install --target
<dir> Pillow`, then `PYTHONPATH=<dir>`); with the bpy 4.2 module, `pip install bpy==4.2.0 numpy Pillow`.
