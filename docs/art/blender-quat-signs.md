# Blender girls: rotation-key flips (sign-continuous quaternions)

Display only: no sim, data or save change (sim id `e4001588f40b` before and after, `COOP_PROTOCOL` unchanged).

## The bug

Blender's glTF exporter writes each rotation key as the bone's rest rotation times its pose. Near a 180-degree rest
(legs, arms, hair tails) neighbouring keys come out as `q` and `-q`, which are the same rotation. three.js
interpolates CUBICSPLINE rotations component by component (`GLTFCubicSplineQuaternionInterpolant`) and normalises
only afterwards, so between two such keys the bone swings through a near-zero quaternion: a one-frame flip of the
limb. Some exported tangents also did not follow their key's sign.

Every Blender-built figure had it: the 27 cage girls, plus the 15 Sentinel Style outfits and the 4 Coming Soon
figures (frozen byte copies of the V2 builds). Every one of them flipped `upper_arm_L` by about 179 degrees in
`pickup`, `hair_back` in idle and walk, and the legs at the end of the attacks.

## The fix

`tools/blender/lib/glbquat.py` `fix_glb_quaternion_signs(path)` (numpy only, no bpy) rewrites every rotation sampler
of a written GLB in place (same accessors, same byte size):

* keys are made sign-continuous: a key whose dot product with the key before it is negative is negated;
* each CUBICSPLINE key gets Catmull-Rom tangents (in = out, per second, for non-uniform times). Looping clips whose
  first and last keys are the same rotation get cyclic tangents across the seam. Both ends are flat in the one-shot
  clips (`attack_*`, `appear`, `death`, the ones `GlbAnimator` plays with `LoopOnce`) and in any track that does
  not close.

`tools/blender/build_characters.py` `_build_unit` calls it right after `optimize.optimize_glb(out)`, so every cage
girl, full and LOD, gets it on every build. The frozen outfit and Coming Soon copies are not rebuilt (they are V2
builds), so the same function was run on them in place:

```sh
cd tools/blender && .venv/bin/python -m lib.glbquat ../../public/models/characters/sentinel-*.glb ../../public/models/characters/future-*.glb
```

The rebuilt girls (bpy 4.2.0, Python 3.11) match the shipped files exactly in mesh, skin and key values (rotations
compared up to sign), and the file sizes are within 4 bytes (JSON padding). Only the rotation tangents and the signs
of the flipped keys changed. The largest files stay inside the budget: Ena 477 KB of 480 KB full, 236 KB of 240 KB LOD.

## Measured (three's AnimationMixer in node, every 10 ms, `tests/models/loadGlb.js`)

The worst bone turn and the worst skinned vertex jump (a share of her height) between two 10 ms samples, over all
clips, full model:

| Girl | Bone, before | Vertex, before | Bone, after | Vertex, after |
|---|---|---|---|---|
| Akane | 179° `upper_arm_L` (pickup) | 75% (cheer) | 7.8° `forearm_R` (attack_cast) | 5% (attack_cast) |
| Aoi | 179° `upper_arm_L` (pickup) | 104% (cheer) | 5.6° `forearm_R` (attack_bow) | 4% (attack_bow) |
| Azami | 179° `upper_arm_L` (pickup) | 118% (cheer) | 9.9° `upper_arm_R` (attack_throw) | 15% (attack_throw) |
| Chigusa | 179° `upper_arm_L` (pickup) | 74% (cheer) | 7.8° `forearm_R` (attack_cast) | 5% (attack_cast) |
| Chika | 179° `upper_arm_L` (pickup) | 67% (pickup) | 19.6° `upper_arm_R` (attack_smash) | 33% (attack_smash) |
| Ena | 179° `upper_arm_L` (pickup) | 65% (pickup) | 9.9° `upper_arm_R` (attack_throw) | 13% (attack_throw) |
| Fuu | 179° `upper_arm_L` (pickup) | 89% (cheer) | 12.3° `upper_arm_R` (attack_sweep) | 17% (attack_sweep) |
| Hotaru | 179° `upper_arm_L` (pickup) | 65% (pickup) | 7.8° `forearm_R` (attack_cast) | 5% (attack_cast) |
| Iroha | 179° `upper_arm_L` (pickup) | 63% (pickup) | 7.8° `forearm_R` (attack_cast) | 5% (attack_cast) |
| Kaede | 179° `upper_arm_L` (pickup) | 87% (victory) | 8.0° `forearm_R` (attack_thrust) | 9% (attack_thrust) |
| Kage | 179° `upper_arm_L` (pickup) | 65% (pickup) | 9.9° `upper_arm_R` (attack_throw) | 13% (attack_throw) |
| Kinu | 179° `upper_arm_L` (pickup) | 65% (pickup) | 7.8° `forearm_R` (attack_cast) | 5% (attack_cast) |
| Marumi | 179° `upper_arm_L` (pickup) | 90% (victory) | 9.9° `upper_arm_R` (attack_throw) | 14% (attack_throw) |
| Midori | 179° `upper_arm_L` (pickup) | 65% (pickup) | 9.9° `upper_arm_R` (attack_throw) | 14% (attack_throw) |
| Miko | 179° `upper_arm_L` (pickup) | 82% (victory) | 7.8° `forearm_R` (attack_cast) | 5% (attack_cast) |
| Momo | 179° `upper_arm_L` (pickup) | 96% (victory) | 7.8° `forearm_R` (attack_cast) | 5% (attack_cast) |
| Ouka | 179° `upper_arm_L` (pickup) | 90% (cheer) | 7.8° `forearm_R` (attack_cast) | 6% (attack_cast) |
| Raika | 179° `upper_arm_L` (pickup) | 89% (cheer) | 7.8° `forearm_R` (attack_cast) | 6% (attack_cast) |
| Rei | 179° `upper_arm_L` (pickup) | 82% (pickup) | 15.1° `upper_arm_R` (attack_slash) | 19% (attack_slash) |
| Sango | 179° `upper_arm_L` (pickup) | 87% (victory) | 3.5° `chest` (attack_cannon) | 13% (attack_cannon) |
| Seiran | 178° `upper_arm_L` (pickup) | 84% (cheer) | 8.0° `forearm_R` (attack_thrust) | 10% (attack_thrust) |
| Shiro | 179° `upper_arm_L` (pickup) | 65% (pickup) | 2.8° `thigh_L` (pickup) | 4% (attack_rifle) |
| Suzu | 179° `upper_arm_L` (pickup) | 89% (victory) | 7.8° `forearm_R` (attack_cast) | 5% (attack_cast) |
| Umeko | 179° `upper_arm_L` (pickup) | 88% (cheer) | 7.8° `forearm_R` (attack_cast) | 6% (attack_cast) |
| Wakaba | 179° `upper_arm_L` (pickup) | 64% (pickup) | 9.9° `upper_arm_R` (attack_throw) | 14% (attack_throw) |
| Yuki | 179° `upper_arm_L` (pickup) | 65% (pickup) | 7.8° `forearm_R` (attack_cast) | 5% (attack_cast) |
| Yuzuha | 179° `upper_arm_L` (pickup) | 61% (pickup) | 7.8° `forearm_R` (attack_cast) | 5% (attack_cast) |
The outfit and Coming Soon copies: the worst bone turn went from 178.6° to 19.6°, the worst vertex jump from 104% to 33%.
After the fix, every worst case sits inside an attack swing. The largest is Chika's hammer smash, where the hammer
head travels a third of her height in 10 ms; before the fix her arm turned 35.4° there, and now it turns 19.6°.
In Aoi's idle, `hair_back` flipped 98.3° before and turns at most 0.1° now; in her walk the worst step went from
162.6° (`hair_back`) to 2.7°.

## Regression check

`tests/models/glb.test.js` "Blender figures: rotation keys" covers every manifest entry without a `source` (the cage
girls and the 19 outfit and Coming Soon copies), full and LOD. For each one it checks that the rotation keys are
sign-continuous and that no bone turns 45° between two 10 ms samples of any clip through three's AnimationMixer. It
fails on the old files (Aoi: `cheer hair_back key 1`).

## Clip strips

`tools/tripo/clip_strips.py` (brought over from `fix/model-quality`) has a new `--shading color` option for the
vertex-coloured cage girls. In that mode workbench shows the vertex colours, so the face texture is not drawn. It
needs EGL (`apt-get install libegl1 libegl-mesa0 libgl1-mesa-dri`) and `EGL_PLATFORM=surfaceless` in a container:

```sh
EGL_PLATFORM=surfaceless tools/blender/.venv/bin/python tools/tripo/clip_strips.py --glb public/models/characters/aoi.glb --out /tmp/aoi.png --shading color --size 160
```

The strips for all 27 girls (battle view, 10 frames per clip) are in `docs/review/blender-quats/strips-1.jpg` to
`strips-9.jpg`. No T-poses, no broken or wrapped limbs, and the feet stay planted in walk and idle. Look notes,
unchanged by this fix (the keys are the same):

* **hurt:** every girl bows her head about 45° (arms over her head). From the 48° battle camera the crown faces the
  viewer and the big chibi head hides her face and most of her body for the whole clip.
* Kinu's cream blazer (`#f2e4c4`) and Ouka's pale top sit close to their skin tone in flat light.
* Yuki reads as almost one pale grey.

## Patch note (draft for the shipper)

The version is the next Pages run number, so the entry is added at release time:

* fixed: "The girls no longer flick an arm, a leg or their hair for a single frame in their idle, walk,
  cheer and attack animations; the outfit and Coming Soon models too."
