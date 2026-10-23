# Lively figures: the painted girls' rebuild (clips, springs, offline flatten)

These scripts rebuilt the four painted (Meshy) girls, Noa, Hikari, Hana and Ruri, for *Lively figures* and the
*Clean cel* figure look (`docs/MODELS.md`, "Lively figures and the figure look"). Each girl keeps her approved
shipped mesh, eye boxes, weights and look B maps. She gets four library clips, a chibi post-pass on them, spring
bones where her rig has none (Noa's buns and ribbon) and a second, flattened base colour (`extras.flat`) that the
Clean cel look draws on. No Meshy credits are needed to rebuild: the clips were bought once on Noa's rig R1.

Nothing big lives in the repo. `paths.py` reads the work folder from `SAKURA_LIVELY_WORK` (default
`<repo>/.lively-work`, ignored by git) and the Meshy clip GLBs from `SAKURA_MESHY_CLIPS` (default `<work>/meshy/`).
Put the pre-rollout shipped GLBs in `<work>/noa/src/noa.ship[.lod].glb` and `<work>/girls/src/<girl>.ship[.lod].glb`
(for example `git show a0b5b75:public/models/characters/noa.glb > noa.ship.glb`).

| script | runs in | what it does |
|---|---|---|
| `flatten.py`, `flatten_girl.py` (+ `flatlib.py`, `glbmesh.py`, `gmesh.py`) | Python, numpy + Pillow | The offline flatten: labels every texel with the girl's house palette over the mesh, turns plaid into one solid colour with one hem line, protects the face, writes `<work>/…/flat/*_base_flat.png`. The per-girl palettes are the `NOA` and `PROFILES` tables. |
| `spring_weights.py` | Python | Noa's bun and ribbon spring-bone weights (`<work>/noa/build/springs_<detail>.npz`). |
| `build_noa.py`, `build_girl.py` (+ `girllib.py`, `rigtest_lib.py`) | Blender 5.x, headless | Retargets the library clips (338 idle, 415 happy, 298 cheer, 178 hurt) onto the shipped skeleton and runs the post-pass: head ×0.6 / neck ×0.75, posture (Hana, Ruri: the spine chain's mean pitch and the stance height back to her shipped clip's, so the library's adult slouch on bent knees goes; `tests/models/livelyPosture.test.js`), face guard for the 48° camera, head clearance, prop wrists locked, root travel removed, feet pinned, 20 fps. Writes `<work>/…/out/*.raw.glb`. |
| `pack_noa.py`, `pack_girl.py` (+ `slim.py`) | Python | Packs with `tools/meshy/lib/pack.py`, puts the shipped look B maps back byte for byte, adds the flat texture, and trims the maps that matter least per detail level so the files stay near their old sizes. Writes `<work>/…/out/<girl>[.lod].glb`: copy those to `public/models/characters/`. |

```bash
export SAKURA_LIVELY_WORK=/path/to/work SAKURA_MESHY_CLIPS=/path/to/meshy-clips
python flatten.py $SAKURA_LIVELY_WORK/noa/src/noa.ship.glb $SAKURA_LIVELY_WORK/noa/flat/full     # Noa (and .lod.glb -> flat/lod)
python spring_weights.py $SAKURA_LIVELY_WORK/noa/src/noa.ship.glb $SAKURA_LIVELY_WORK/noa/build/springs_full.npz
python spring_weights.py $SAKURA_LIVELY_WORK/noa/src/noa.ship.lod.glb $SAKURA_LIVELY_WORK/noa/build/springs_lod.npz --ref $SAKURA_LIVELY_WORK/noa/build/springs_full.npz
blender -b --factory-startup --python build_noa.py -- full                  # then -- lod
python pack_noa.py full                                                     # then lod
python flatten_girl.py hikari full                                          # hikari | hana | ruri, full | lod
blender -b --factory-startup --python build_girl.py -- hikari full
python pack_girl.py hikari full
npx vitest run tests/models                                                 # clip caps, flat texture, spring weights, sizes
```
