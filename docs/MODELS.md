# Chibi models V2 — pipeline notes

The academy girls are built by a programmatic Blender pipeline (`tools/blender/`, Blender 4.2 as the
`bpy` python module) and shipped as one GLB per unit in `public/models/characters/`. The method is the
one from the jaeysart "sitting chibi" tutorial (its example images are third-party, so they stay
on the owner's PC in the git-ignored `docs/reference/thirdparty/`): a handful of
quad **cages** that get a Catmull-Clark **Subdivision Surface**, creased edges where tips must stay
sharp, and a **painted face texture** instead of face geometry.

```
python3 tools/blender/build_characters.py              # every roster unit, full + LOD
python3 tools/blender/build_characters.py hikari aoi    # just these
python3 tools/blender/build_characters.py hikari --blend /tmp/hikari.blend   # also save a .blend to inspect
python3 tools/blender/build_characters.py --no-lod --no-anim                 # faster look-dev builds
```

Each unit takes ≈1.5 s. The roster (palette + look) is read straight from `src/data/units.js`
(`tools/blender/dump_units.mjs` dumps it to JSON through node). Output:

| file | what | budget |
|---|---|---|
| `<id>.glb` | full detail (quality `high`), ≈8–10k verts | ≤ 480 KB (typ. 360–450) |
| `<id>.lod.glb` | one subdivision level lower (quality `medium`/`low`), ≈2.6–3k verts | ≤ 240 KB (typ. 190–215) |
| `manifest.json` | `{ id: { file, lod, size, lodSize, animations, vertices } }` | |

## How a girl is constructed (`tools/blender/lib/`)

| module | content |
|---|---|
| `mesh.py` | cage primitives (`box`, `sphere` = 26-vertex rounded cube, `tube` along a path with elliptic cross-sections and pointed creased tips, `lathe`, `plate`), `finish()` = subsurf (+ mirror / solidify) baked into the mesh, `crease()`, vertex colours (`Col` attribute, linear RGB), bone vertex groups, `weight_by_bones()` (smooth nearest-two-segments weights for continuous limbs), `join()` |
| `proportions.py` | world-unit landmarks: girls 0.9 tall / head ≈45 %, heroes 0.98 tall / head ≈38 %, stubby limbs, big shoes, eye line |
| `body.py` | head (26-vertex cage shaped before subdivision: flat face plane, cheeks, narrow chin, round cranium; level 3), ears, neck, soft tapered torso, arms + mitten hands, legs with socks/tights, shoes + soles. The head gets **planar front-projection UVs** (u across the head, v chin→top); back-facing polygons collapse onto a skin-only texel so the face never wraps around |
| `face.py` | PIL face **atlas** (3×3 cells: idle, blink, attack, happy, hurt, dizzy, wink, shy, surprised): big glossy eyes with dark upper-lid stroke, iris gradient, lid shadow, two highlights, lashes, thin brows in the hair colour, tiny mouth, blush; styles `round/sharp/sleepy/sparkle/closed`, expressions `smile/smug/calm/determined/shy/cheerful`. 256² cells for girls, 341² for heroes; quantised to a palette PNG (≈50–70 KB). Opt-in look keys: `softFace` (thinner mid-tone brows, gentler upper lids), `brows` (brow shape of the resting cells; `soft` raises the inner ends so the brows do not bend into a V under the 48° camera), `eyeTilt` (degrees: each eye of the resting, blink and attack cells turned inner corner up, so the lash line does not bend into a V either) |
| `hair.py` | cap shell over the cranium (shrink-wrapped onto the real head mesh with a fixed gap, then thickened outwards, inner shell in `hairShade`), **bangs** (`straight/swept/split/hime/messy`), side locks, back curtains, tails and buns per `hairStyle` (`long/hime/wavy/bob/short/twintails/ponytail/side/braid/buns`). Every lock is one broad tapered tube with a creased pointed tip. Tails / long back hair get their own bones (`tail_L`, `tail_R`, `hair_back`). Added for the temporary chibis: styles `bunsBob` (Iroha; `bunSides` picks the bun sides, default both), `sideBraid` (Ena, a puffed side braid on `tail_L`), bangs `blunt`; opt-in look keys `bangRaise` (bang tips N° higher), twin-tail `tailAz tailEl tailLen tailR tailOut tailCurl tailDroop tieT tieLen`, ponytail `ponyS ponyAz ponyEl ponyLen ponyR ponyOut ponyCurl ponyDroop sideLen sideFlare sideWave`, wavy `hairLen`; tail ties take `palette.tie` (else the accent) |
| `outfit.py` | colour plan per `look.outfit` (`spec()`) + extra cages: sailor collar, ribbons/bows, pleated skirts, cuffs, puff/wide sleeves, belts, breastplate + pauldrons + cape (armor), hood, apron, obi, pockets…; the temporary chibis added `trackJacket` (Fuu), `sailorCardigan` (Iroha), `blazerCardigan` (Ena, tartan skirt + open cardigan hem), `staffTrack` (Kanna), `stageCoat` (Yoriko), `flightJacket` (Seiran) and an optional hem `stripe` on the shared `skirt()` |
| `accessory.py` | ribbon, bunny/cat/fox ears, hairpin, beret, witch hat (raises the halo), horns (default oni horns; `ctx.horn_shape` `curl` = ram horns, `dragon` = long swept-back horns), flower, goggles, hood, headband, crown, **cap** (peaked captain's cap: accent crown, dark band and visor, gold badge; raises the halo), `leafClip` (Fuu), `mirrorOrnament` (Iroha), `rose` (Ena), `catHeadset` (Yoriko), horn shapes `oni` (Kanna) and `crescent` (Seiran, `palette.horn`) — all placed above the hair surface (`HAIR_TOP`) |
| `weapon.py` | one cage model per `look.weapon`, weighted to `hand_R` (bow/tome/shield to `hand_L`, mallet in both hands); `kind_of()` maps weapons to attack kinds. Roster merge added `mic` (cast), `shield` (smash), `mirror` (cast, glowing glass on the halo material), `spear` (thrust), `mallet` (taiko bachi, smash), `puppet` (control bar + strings + tiny marionette, cast), `cards` (fan of four cards, throw); the temporary chibis added `turbineFan` (sweep), `roseCards` (throw), `bachi` (smash), `marionette` (cast, left hand) and `stormSpear` (thrust) |
| `extras.py` | per-unit extra parts from the tools-only tables `EXTRA_PARTS` / `HORN_SHAPE` in `build_characters.py` (keyed by unit id, no schema change): `foxTail` (Luna), `quiver` (Hana; the `falcon` part stays in the library but is no longer listed: companions are separate figures), `foxFamiliar` (in the library, no longer listed for Ruri), `taikoStand` (Kanna's taiko on a stand, weighted to `root`; the old hip `taikoDrum` stays in the library), `tailBows` (Fuu), `cardDealer` (Ena), `flightHeadset` (Seiran), `mortarTube` (Tsubaki), `monocle` (Kohaku). They are ordinary vertex-coloured cages joined into the **body** mesh and weighted to hips/chest/head, so every GLB keeps exactly three primitives |
| `halo.py` | ring/star/petal/gear/moon/flame/wave/crown/snow/bolt/leaf/eye/crescent (a quad band between two arcs, so the bite stays open after subdivision; the shared `moon` is one concave n-gon that subdivides into a filled disc with mixed winding), emissive `halo` material, bone `halo` |
| `rig.py` | armature: `root, hips, spine, chest, neck, head, halo, shoulder/upper_arm/forearm/hand _L/_R, thigh/shin/foot _L/_R` (+ hair bones). No dots in bone names so three.js keeps them verbatim in track names |
| `anim.py` | actions authored as a few keyframes at 24 fps in armature space (`Poser.key(frame, {bone: (pitch, roll, yaw)})`), bezier → exported as CUBICSPLINE. Clips: `idle` (personality per expression, breathing, halo float), `walk`, `attack_<kind>` with anticipation → strike → recovery (`slash, thrust, bow, rifle, cannon, cast, throw, smash, sweep`), `cheer`, `victory` (weapon-specific pose), `hurt`, `pickup` (wriggle). Opt-in look keys: `chinUp` (degrees added to neck + head in every key, split by `chinSplit`, default 45 / 55 %), `holdPose` (merged into the idle weapon hold), `pin` + `pinFollow` (an arm held in a fixed pose in every clip, keeping a share of the clip's own motion) |
| `export.py` | materials (`body` = vertex colours, `head` = face atlas, `halo` = emissive), glTF export (actions, no sampling, vertex colours), GLB re-packing (swap in the optimised PNG, write extras) |
| `optimize.py` | KHR_mesh_quantization post-pass: int16 positions, int8 normals, uint8 colours/joints/weights, uint16 UVs (head only), uint16 indices — about half the size, read natively by three.js |

The whole character is stored at **half scale** (so positions fit normalised int16) and the runtime
scales the root by `asset.extras.unitScale` (= 2). Feet at y = 0, faces +Z after export.

## Runtime (`src/models/`)

* `index.js` keeps the CONTRACT §7 API. `preloadModels(ids?, { detail })` loads GLBs (all units at full
  detail when called without arguments, a few files at a time). `buildChibi(unit, { quality, pose, detail })`
  is synchronous: it instantiates a loaded GLB (`detail` defaults to `full` for quality `high`, `lod`
  otherwise; if only the other detail is loaded it is used immediately and the preferred one is fetched for
  later builds), or returns the V1 procedural chibi as a placeholder and **upgrades the same group in
  place** when the GLB arrives. In node / offline the procedural fallback is what you get.
* `glbChibi.js`: GLTFLoader + SkeletonUtils.clone per instance, `MeshToonMaterial` (3-step ramp for the
  body, a soft 2-step ramp for the face so the painted eyes stay bright), unlit emissive halo with a
  coloured outline, inverted-hull outline clones that share the skeleton (skipped at quality `low`),
  `AnimationMixer` with crossfades, one-shot attacks layered over idle, blinking + expression cells
  via texture offset (`userData.setExpression('happy'|...|null)`).
* Draw calls per girl: body + head + halo (+ 3 outlines).
* Selected look (`highlight.js`, `userData.setHighlight(true)` while she is tapped in battle): she keeps
  her own colours. `SELECT_HIGHLIGHT`: a neutral white emissive at 0.15 that the shader multiplies by her
  own albedo (+15 % of her own colour as self-light, so hue and saturation stay as painted) and a soft
  white rim along her silhouette, 0.35 × smoothstep(0.6, 1, 1 − N·V): nothing where she faces the 48°
  battle camera (her front and top sit at N·V ≈ 0.67–0.74; a (1 − N·V)^2.5 rim tried first washed her
  whole front pale). One look for the procedural chibis, the GLB girls (body and painted face) and the
  painted figurines; the selection ring under her says which girl is selected. The toon highlight is
  cached and shared (`selectToonMaterial`, never disposed by an instance), the face gets its own twin
  per instance, and the figurine has one highlight program shared by every eye state; each kind
  compiles its highlight program on the first tap. It replaced a blue wash (`#4d6dff` × 0.35) that
  turned Chika's brown hair and orange suit purple / lavender; `tests/models/highlight.test.js` guards
  the hue.

### Lively figures and the figure look (decision #149)

Two display-only settings in Settings → Graphics (`src/models/figureOptions.js`): **Lively figures**
(saved `livelyFigures`, default on) and **Figure look: Clean cel / Glossy** (saved `figureLook`, default
`'cel'` while the owner decides, #145; Glossy is look B). A branch build saved the look as the boolean
`celFigures`: a stored `false` (a real choice) is read once as Glossy, and its first key `celTextures` (an
unchosen default) is ignored. Dev overrides `?lively=0|1&cel=0|1&flat=0|1`. Nothing here is in the co-op
graph (`tools/simId.mjs` stays `92e2e22527cf`; `tests/models/lively.test.js` checks the files stay out).

* **Lively figures**, skeleton layer (`livelyRig.js`, after `mixer.update` in `GlbAnimator`): breathing
  (chest / spine / shoulders, head counter-rotates), weight shift (pelvis roll with legs kept
  vertical, spine sway, head tilt), glances every 3–7 s, the head leading a turn (chest 20 % / neck 30 % /
  head 50 % of the turn still to go), attack wind-up lean and release snap, a dazed head circle while
  disabled, a happy bob on victory, and damped springs on every hair / tail / braid / bangs / coat bone a
  GLB already has (Hikari's 58-bone rig included). Every touched bone gets its clip value back before
  the next mixer update. Loops start at a random point and run at 0.94–1.06×, so copies never move in
  step; crossfades 0.3 s; disabled plays `hurt` once over a slowed idle instead of a 0.4 s loop.
* **Attack by body half** (`GlbAnimator.playLayers`, `ATTACK_LAYER` in `glbChibi.js`): the attack clip is
  split once per asset (`splitClipByBody`: the first spine bone and everything under it, against root /
  hips / legs). The upper half plays at weight 4 over the base loop's 1 (80 % attack, the arm pose the old
  0.25 dip gave), the lower half at 1/3 (25 %: a hint of the step into the strike), so her legs and hips
  keep the idle's weight shift and the base loop is never dipped. Lively off keeps the old whole-body
  one-shot over a base at 0.25. The stun's `hurt` stays a whole-body one-shot.
* **Runtime skirt bones** (`livelySkirt.js`): once per asset, four bones (front / left / back / right,
  children of the hips at the hips' bind pose) take a waist-to-hem gradient of the skirt's weight; the
  skirt is found geometrically (between the knee band and the waist, hips / spine / thigh weights only,
  outside the measured leg radius). At rest they deform exactly as before. One spring swings them: hem
  outward ≤ 12°, inward ≤ 3°. Found on Noa, Hana, Ruri and the Blender girls with skirts or dresses.
* **Whole-figure layer** in battle (`src/render/livelyPose.js`, `actors.js`): placement drops her in
  (gravity, landing squash) instead of the elastic pop; the sim's cooldown (read only) drives a wind-up
  squash + lean for girls attacking once per 0.45 s or slower, the attack event a stretch + snap; body
  turns at 6/s (the head leads); a tiny breathing squash. Reduce motion: half the amplitude, slower,
  no drop (a 0.15 s scale-in). Quality medium: springs at 30 Hz; low: no springs or breathing.
* **Clean cel look** (`celFigure.js`, painted Meshy figures only): the figure's palette is measured
  once (k-means in OKLab over the texels under her UVs; same-hue clusters that differ only by baked
  light merge); each texel snaps to its nearest palette colour (eyes and far-off details keep their
  paint); one hard shadow from the key light with a per-colour hue-shifted shade (whites → lavender,
  warm → rose, skin barely); the face never takes a stripe. Off = the glossy look B (`figurine.js`).
  A GLB that carries an **offline-flattened base colour** (`asset.extras.flat`: `texture` index of one more
  WebP texture on no material, `palette` = its exact flat colours, `eyes` = the flat skin for the closed-eye
  lids) is drawn on that map instead, with no runtime snap (`figSnapMul` 0; the palette only picks each
  texel's shade tone) and its outline tinted from it too. Look B keeps the painted map and its PBR maps.
* **Authored spring bones** (`asset.extras.springBones`): any `hair* / bangs* / tail* / braid* / bun* /
  coat* / ribbon*` bone a GLB has springs; buns have their own small, quick kind (clamp 10°).
* **Glances per clip** (`asset.extras.clipMarks[clip].glance`, 0–1): a base clip that looks around by
  itself runs the layer's glances smaller (Noa's 338 idle: 0.4×). Reduce motion halves glances too. The
  dazed circle of a stun eases in only after the `hurt` one-shot has played.
* **Face bone** (`asset.extras.faceBone: 'neck'`): a face skinned across neck + head (Hikari's owner rig,
  whose head joint sits above her eyes) takes the layer's head share on the neck, so it turns as one piece
  and never shears.
* **`<clip>_short`**: a figure may keep its old clips next to new ones (Noa: `idle_short`, `cheer_short`,
  `hurt_short`); with Lively figures off the animator plays those, exactly the shipped behaviour.
* Preview + captures: `previews/lively.html` (`?mode=battle|closeup|perf|metrics`).
* **Rebuild + file sizes**: `tools/blender/lively/` (README there) rebuilds the four painted girls from their
  pre-rollout GLBs (0 credits; the Meshy clip GLBs stay outside the repo). To pay for the flat texture and
  the longer clips, `slim.py` trims what each detail level can spare: the full model's look B normal map
  goes to 512, and the LOD's two base colours go to 512 (the LOD is only drawn at battle distance; close-up
  viewers load the full model). Sizes: Noa 1.22 MB / 0.59 MB, Hikari 1.34 / 0.65, Hana 1.22 / 0.60, Ruri
  1.35 / 0.62 (shipped before: 1.23 / 0.57, 1.31 / 0.60, 1.21 / 0.56, 1.33 / 0.61). `glb.test.js` caps
  them at 1.4 MiB / 0.65 MiB.

#### Noa, rig rollout step 1

`noa.glb` / `noa.lod.glb` are the approved shipped Noa (noa-A head, eye boxes, weights, look B maps)
rebuilt by `tools/blender/lively/` (`build_noa.py`, `spring_weights.py`, `flatten.py`, `pack_noa.py`;
Blender 5.2 + numpy, 0 credits):

| clip | source | notes |
|---|---|---|
| `idle` | Meshy library 338 Short_Breathe_and_Look_Around (7.85 s) | `clipMarks.idle.glance` 0.4 |
| `happy` | 415 Happy_Sway_Standing (10 s) | between-wave mood loop (`clipMarks.happy.mood`); the animator's state `happy` plays it (the battle does not send it yet) |
| `cheer` | 298 Cheer_with_Both_Hands_Up (1.85 s) | head clearance: arms end out to the sides; victory falls back to it |
| `hurt` | 178 Hit_Reaction, cut to 1.2 s | hips' horizontal travel stripped, both feet pinned by two-bone IK |
| `attack_smash`, `walk`, `*_short` | the shipped clips | |

All four were bought once on Noa's Meshy rig R1 and retargeted onto the shipped skeleton by world-space
rest deltas, then: head ×0.6 / neck ×0.75, mean world head pitch to the shipped −17.3°, a per-frame face
guard (head world pitch never above −12°, so the face never drops under the bangs at the 48° camera),
head-clearance abduction, shield wrist locked, hips travel eased back, feet pinned on their planted
frames, everything resampled to 20 fps. `bun_L` / `bun_R` (children of `head`, pivot where the bun meets
the head) and `ribbon` (child of `chest`, the bow's tails) carry smooth 0 → 1 weights. The flat base
colour comes from the offline flatten (PLAN §5.2 TX2): regions by body part + mesh adjacency, plaid →
soft grey `#C4C3CB` with one mint hem line along the real pleated hem, colours snapped to house values
(caramel `#D7A174`, blazer `#928CA5`, mint `#ADDDC2`, skin `#FCE6D3`, …), eyes / blush / mouth kept,
brightness 0.58 → 0.71. `tests/models/glb.test.js` caps (PLAN §6.5): idle 8 s, cheer / victory 4,
hurt 1.2, attack 1.2 (with a contact mark when over 0.6), dizzy 6, deploy 2, fidgets 5, mood loops 10;
`*_short` keep the old caps.

#### Hikari, Hana, Ruri, rig rollout steps 2–3

`hikari` / `hana` / `ruri` (`.glb` + `.lod.glb`) are their approved shipped figures (meshes, eye boxes,
weights, look B maps) rebuilt by `tools/blender/lively/` (`build_girl.py`, `flatten_girl.py`,
`pack_girl.py`; Blender 5.2 + numpy, 0 credits) with the same four library clips as Noa (bought once on her rig R1; retargeted
onto each shipped skeleton) and the same post-pass (face pitch target and guard from each girl's own
shipped idle), plus one more step: every new clip is turned about the vertical so its mean face yaw is her
shipped idle's (the 338 idle stands ~13° turned to her right; at the battle camera a girl facing a monster
at her side then showed only her hair). Per girl:

| girl | clips | held prop / rig notes | flat base colour |
|---|---|---|---|
| Hikari | `idle` 338, `happy` 415, `cheer` 298, `hurt` 178 | 58-bone owner rig: Meshy Head drives her **`neck`** (her face is skinned across neck + head; `extras.faceBone: 'neck'` makes the lively layer turn the head's share from the neck too). Sword arm = her shipped guard (idle / happy / hurt) or the shipped cheer's raised salute; the library cheer's arm swung the blade across her face. Grip from the shipped idle. Hair / bangs / coat chains: runtime springs | white pinned `#FAFAF8` (her coat never goes cream), pink `#F7A3BF`, gold trim kept, teal, navy |
| Hana | the same four | bow (+ falconry glove) in her left hand: her bow arm keeps its shipped pose (bow upright at her side); with the clip's arm the bow crossed her chin from the 48° camera. Kaze stays a separate companion | plaid skirt → solid olive-brown `#625538` + one mustard hem line |
| Ruri | the same four | her book hangs at her left hip (skinned to the hips): left wrist locked, left arm swing ×0.6 so the hand stays at the book. Kon stays a separate companion | plaid skirt → solid navy `#2B3D6E` + one sky hem line; the book its own block; hair `#3F5DB4` (still passes her `hairGuard`) |

Attacks stay the shipped `attack_*` clips with the layer's wind-up and snap; the Meshy library's archery
and cast clips were watched (free previews) and rejected for chibis (side-on turns, overhead reaches,
draw hand at the face, deep lunges), so no credits were spent.

## Roster merge stand-ins (2026-10-13)

The 18 shared girls (everyone but Hikari, whose battle model is the owner's Meshy figure) were rebuilt from
their old Codex designs (`src/data/units.js` palette + look, ROSTER_SPEC §4.2). These are **temporary
stand-ins** until real chibis exist; the V2 looks they replaced live on as the Sentinel Style outfits
(`sentinel-<id>.glb`) and the four Coming Soon units (`future-<id>.glb`), byte copies that the builder never
touches. Rebuild only the girls you changed and never pass `hikari`:

```
python3 tools/blender/build_characters.py luna nami aoi rei yuki momo akane sango kage umeko shiro midori suzu raika miko hotaru kaede chika
```

Look-dev for girls who are not in `UNITS` yet: write their palette/look to a JSON file and build into a scratch
folder (`--units new.json --out /tmp/glb`), copy the files under `public/models/characters/_lookdev/` (never
commit it) and view them with `previews/models-v2.html?view=row&assets=_lookdev/kanna,_lookdev/fuu&dist=3.6`.

## Stand-ins for the returning girls

The returning girls of the roster wave (`src/data/unitsExpansion.js`) whose real chibi has not landed yet
(`STANDIN_UNITS`, empty since the art wave: Noa, Hana and Ruri have their imported Meshy figures, see "Imported Meshy figures"; Fuu, Iroha, Ena, Kanna, Yoriko and Seiran have temporary Blender chibis, see "Temporary Blender chibis"; the path stays for a future girl who lands before her model) are drawn by
the procedural V1 chibi (`src/models/chibi.js`) from their own `palette` + `look`, in battle, in the student 3D
view and in the formation / lobby. The list lives in `src/models/standins.js` (`STANDIN_UNITS`,
`isStandIn(assetKey)`, keyed by model asset = unit id of the `<id>_default` skin row):

* `preloadModels` drops stand-in ids and `loadCharacter` / `preloadCharacters` resolve `null` for them
  without a request, so there are no `.glb` 404s; `buildChibi` returns the procedural figure with
  `userData.standIn = true` and no GLB upgrade hook.
* Every look value they use has a real procedural piece (horns, cat ears, hairpin, flower; coat, hoodie,
  blazer, sailor; mallet, puppet, spear, fan, bow, tome, shield, mirror, cards).
* Tests: `tests/models/standins.test.js` (exactly the listed girls, procedural at every quality, their weapon and
  accessory are dedicated pieces, nothing fetched in a stubbed browser); `tests/models/glb.test.js` checks
  every other girl's GLB as before (with a count guard) and requires the stand-ins to have **no**
  manifest entry or file; `tests/data/skins.test.js` accepts a stand-in default row without a manifest model.
* Real art landing: build / import her GLB (manifest entry + `<id>.glb` + `<id>.lod.glb`), remove her id from
  `STANDIN_UNITS` and from the test's list, and bump the GLB count in `glb.test.js`. The glb test fails while a
  stand-in id has a manifest entry, so the list cannot go stale.

## Temporary Blender chibis for six returning girls (Oct 2026)

Fuu, Iroha, Ena, Kanna, Yoriko and Seiran get **temporary cage chibis** from this pipeline, matched to their
painted portraits, until their Meshy figures replace them after the monthly Meshy credit reset (Noa, Hana and Ruri
get Meshy figures now). No generator was used for them: everything is built locally with bpy.

* **Looks come from tools-only tables**, not from the unit data. Their portrait looks differ from the placeholder
  `palette` / `look` in `src/data/unitsExpansion.js`, which is in the co-op sim hash, so `build_characters.py`
  carries per-id `LOOK_OVERRIDES`, `PALETTE_OVERRIDES` (which may also set the colour keys a part reads: `legwear`,
  `trim`, `tie`, `horn`, `skirt`, `vest`…) and `SPEC_OVERRIDES` (over `outfit.spec()`: `legwear`, `shoe`, `sole`,
  `glove`, `cardigan`…), merged in `_build_unit()`. A unit without an entry builds exactly as before, and every new
  library option defaults to the old behaviour (the other girls rebuild byte-identical).
* **Display only.** The GLB carries the look; the sim, saves and co-op never read it. Anything that reads
  `palette.*` from the unit data still shows the placeholder colours: the procedural chibi drawn while her GLB loads,
  the 2D card doll fallback and the wiki text. Since v0.1.39 the unit data matches the paintings where it showed most:
  Fuu's hair and bio are cocoa-brown and Noa's eyes rose-pink; the other placeholder colours are still the data's.
* **Face at 48°.** From the battle camera the curved head bends level brows and lash lines into a V, so with the
  shared face every girl read stern. All six share `BATTLE_FACE` in `build_characters.py`, opt-in face options in
  `lib/face.py`: `brows` / `attackBrows: 'none'` (no brows on the resting, blink and attack cells, the way the
  imported chibis keep theirs under the fringe; even inner-raised `'tare'` brows still bent into a scowl at battle
  size and read worried from the front, critic round 2b; the cheer and hurt cells keep theirs), `lidDip` / `lidLift` (the upper lash
  line no longer dips at the inner end and its outer end sits a little low), `lidShade` (a lighter lid shadow) and
  `browWidth` (thinner brows on the cells that keep them); `browTone` puts those brows in a hair mid tone instead of
  the dark lash mix. Every clip
  carries a chin-up (`chinUp`, 20–22°), as Hikari's clips do, and the bangs end higher (`bangRaise`), so the eyes
  clear the bangs under the battle camera. Kanna and Yoriko get round eyes: their unit looks say `sharp` and
  `sleepy`, which glared or looked bored from above (critic round 2, Oct 20). Even with no brows the upper lash lines
  still bent into a V from 48° (the inner ends drop towards the nose), so five of the six read stern or bored next to
  the imported chibis (critic round 3): `eyeTilt` (9°) draws each eye on its own layer and turns it inner corner up on
  the resting, blink and attack cells, so the lash line lies level at battle size and reads gently drooped from the
  front, and `lidShade` is 0.3. The tilt costs about 2–4 KB of atlas per girl.
* **Critic round (Oct 20).** The files started from the critic's final builds (reproduced byte for byte by these tools, before the face rounds above): Iroha's
  collar piping sits on her collar (its points were drops below the collar line passed as absolute heights, so three
  silver arcs lay on the ground under her feet) and her iris is a deeper lavender; Ena wears the `crescent` halo (the
  unit's `moon` read as a magenta blob on her crown); Yoriko's crescent no longer reads as a disc and her ponytail
  rises less (`ponyDroop` 0.4); Seiran has round eyes, as in her laughing portrait.
* **Rebuild one girl per process.** The bytes of a girl depend on the girls built before her in the same process,
  and the bpy module segfaults at interpreter exit (rc 139) after the files and the manifest are written (check for
  the `[build] manifest:` line). Each build is deterministic:

```
for id in fuu iroha ena kanna yoriko seiran; do python3 tools/blender/build_characters.py $id; done
```

* **Meshy later.** `tools/meshy/build_meshy_chibi.py` writes her `<id>.glb` / `.lod.glb` with `source: 'meshy'`;
  from then on the builder keeps her files, and her override entries can go.

| girl | full / LOD | at battle zoom (Hikari 66 px) | look (from her portrait) | known |
|---|---|---|---|---|
| Fuu | 479,448 / 239,340 B (10,324 / 3,647 verts) | 50 px | milk-chocolate twintails set high with mint ribbon bows, a gold leaf clip, an open mint track jacket with gold piping over a white sailor blouse, a mint pleated skirt, pine-green leggings, white high-tops, a big folding fan with three glowing turbines; chin-up 20° | mid-sweep the fan turns edge-on to the camera |
| Iroha | 466,292 / 220,520 B (10,094 / 3,258 verts) | 52 px | a plum-black bob with one high bun on her left (`bunSides`; two buns read as bear ears and are not in her painting) and a silver mirror ornament on it, a blunt fringe, a charcoal sailor top and plum scarf under a long open plum cardigan, black tights, loafers, her hand mirror; round lavender eyes; chin-up 20° (neck / head 60 / 40, `chinSplit`) | — |
| Ena | 489,108 / 242,228 B (10,602 / 3,737 verts) | 50 px | rose-pink layers and one thick braid over her left shoulder tied with a crimson ribbon, a crimson rose, a black blazer piped in crimson over a long black cardigan, a red tartan skirt, black tights, a fan of five pearl cards held up in her right hand (`holdPose`), a wrist card dealer, the crescent halo; chin-up 20° | about 2.4 KiB (full) and 3.4 KiB (LOD) under the budgets, so a new part needs a trim elsewhere; `walk` ignores the hold, so the card fan hangs flat there. Luna and Kage still wear the shared `moon` halo, which shows as a blob (their GLBs are outside this wave) |
| Kanna | 463,576 / 235,908 B (9,494 / 3,146 verts) | 67 px | high coral twin-tails flaring out with gold cuffs, tall ivory oni horns, a crimson staff track jacket with black panels and gold piping, black slacks, crimson high-tops, carbon bachi with glowing tips, her taiko on a stand at her front-left (weighted to `root`, so it stays put in every clip); round amber eyes; chin-up 20° | `attack_smash` leans her forward and hides her face for a few frames; the sticks strike forward, not on the drum |
| Yoriko | 417,072 / 221,764 B (8,186 / 2,745 verts) | 64 px | a lilac high ponytail tied on her right, a navy cat-ear headset with glowing ears and a mic, an indigo stage frock coat over a lilac waistcoat with gold edging and long tails, navy gloves, trousers and boots, the marionette control bar held up in her left hand (`pin`; since Oct 21 her drone marionette and its threads are a separate figure, `ctx['marionette']['doll']` keeps its home under the bar), the crescent halo; round violet eyes; chin-up 22° | the bar arm stays up in every clip, cheer and victory included; the bind pose stores the prop pre-rotated (no runtime path shows it) |
| Seiran | 439,068 / 229,656 B (8,888 / 3,059 verts) | 64 px | pale sky-blue waves, two gold crescent horns, a white flight headset, a light-blue flight jacket with gold shoulder boards and a teal tie, a steel-blue pleated skirt, blue-grey tights, white flight boots, a white storm spear with a glowing ice blade, a laughing grin; chin-up 22° | in the shared `victory` / `cheer` clips the spear passes through her hair |

## The new girls' figures (UNIT_GAPS §5)

Azami, Kinu, Wakaba, Yuzuha, Ouka, Chigusa and Marumi use the same tools-only `LOOK_OVERRIDES` table: `chinUp: 12`
(the same per-clip chin-up as the returning girls, smaller because their bangs already clear the eyes) and, for
Chigusa, `haloLift` (her halo floats above the straw sun hat, `EXTRA_PARTS` `sunHat`). Their props (strip reel,
needle, tablet, council banner, watering can, bowling ball) are in `lib/weapon.py`. Every other girl rebuilds
byte-identically with them in the library.

## Adding a character

1. Add the unit to `src/data/units.js` with `palette` + `look` (any combination of the existing
   hairStyle / bangs / accessory / outfit / weapon / halo / eyeStyle / expression values just works).
2. `python3 tools/blender/build_characters.py <id>` → `public/models/characters/<id>.glb` + `.lod.glb`,
   manifest updated.
3. Look at it: `node e2e/shot.mjs "/previews/models-v2.html?view=turn&id=<id>&t=0.5" out.png --wait "body[data-ready]"`
   (views: `turn`, `closeup`, `states`, `faces`, `row&ids=`, `game`, `lineup`, `upgrade`, `viewer`).
4. New hair style / outfit / accessory / weapon / halo: add a function to the matching library and
   register it in its dict (`STYLES`, `BANGS`, `OUTFITS`, `ACCESSORIES`, `WEAPONS`, `HALOS`).
5. `npx vitest run tests/models` checks every GLB header (clips, bones, materials, atlas, size).

## Imported Meshy figures (Hikari)

Hikari's battle model is **the owner's own Meshy chibi** (big round head, painted anime face,
white/gold/navy knight coat, teal bow and ribbons, braid crown with gold stars). It is brought in
as-is, not restyled, by `tools/meshy/build_meshy_chibi.py` (bpy 4.2 + numpy + Pillow + `pip install xatlas`):

```
python3 tools/meshy/build_meshy_chibi.py --source <Meshy Character_output.glb> --clips <Meshy-library animated GLB>
```

The two inputs are not in the repo (43 MB + 5 MB): the owner's Meshy export (one skinned mesh,
~93k tris, 58-bone Meshy SmartRig `Bone_000…`, 4k base colour / normal / metallic-roughness) and the
Meshy animation-library GLB from the first Meshy test (Idle_9, Walking_Woman on the standard Meshy
humanoid). One bpy session per detail level:

| step | module | what |
|---|---|---|
| 1 | `lib/lowpoly.py` | weld the seam-split vertices (positions only differ by float noise), decimate a copy (face protected) to 20k tris (LOD 9k), smooth normals, **fresh xatlas UVs** with the face at 2× texel density. Meshy's own UVs are ~13k tiny islands that bleed into colour noise in the mip levels a battle-size figure samples |
| 2 | `lib/bake.py` | Cycles CPU selected-to-active bakes onto the new UVs: base colour (baked at 2048², shipped at 1024²: the downsample gives cleaner edges than a direct 1024 bake, and the 2× face density keeps the eyes crisp in the student close-up), metal/roughness (1024², LOD 512²: the gold trims, stars and buttons are metallic and catch the environment map; without it the gold reads brown) and, full detail only, tangent-space normals from the 93k surface + Meshy's own normal map (1024²: keeps the braid, bang strands and coat embossing that decimation flattens; the LOD skips it, invisible at battle size). The normals are then **flattened to (128, 128, 255) over her skin and painted face** (`flat_skin_normals`: skin-coloured texel patches anywhere + every non-hair texel of the face charts, grown 2 px and feathered): the sculpt's creases under the eyes and on the cheeks read as dirt on a Nendoroid face, while hair, braid and coat keep their relief |
| 2b | `lib/eyes.py` | measures her **painted eyes** for the runtime blink: every face-chart texel is mapped back to 3D, the teal iris texels give the two eyes, iris + lashes + eye white + dark non-skin texels round them give each eye's box; eyelid colours from the skin just above / below the eye, the lash colour, the skin roughness. Stored as `asset.extras.eyes` in the packed position space |
| 3 | `lib/rig_names.py`, `lib/retarget.py` | readable bone names (`root, hips, spine, chest, neck, head, upper_arm_R, …, hair_back1, coat_L1, bangs1`), then the library clips are retargeted by world-space rotation deltas from each rest pose (both rigs are Meshy A-poses) |
| 4 | `lib/sword.py`, `lib/clips_hikari.py`, `lib/posekit.py` | the approved sheet's jewelled sword (crystal blade with white edges, gold star crossguard with a teal gem, magenta gem + grip, teal pommel; 794 tris, vertex colours) parented to `hand_R` with the fingers curled round the grip; clips `idle` 1.5 s (library idle + two knee bounces), `walk` 0.97 s (library walk), `attack_slash` 0.6 s, `cheer` 1.2 s (arms up + hop), `hurt` 0.4 s. The sword arm and the legs are 2-bone IK so the blade path is designed: the wind-up takes the hand out to her right and **back** (blade up behind the line of her face), then a wide descending sweep round her right side, across the front below the chin and out to her left (tip travel ≈ 75 px wide at battle size, torso twist −18° → +24°). Checked numerically over yaw −180…180° and pitch 0/24/48°: the blade never passes in front of her face except seen from behind her right shoulder (yaw ≥ 105° back, where only the jaw edge is visible). Every clip carries a small chin-up / lean back (neck −7°, spine −3°) so the eyes stay readable under her long bangs from the 48° battle camera |
| 5 | `lib/pack.py` | phone packing: stored at half size (`extras.unitScale` brings her back to the battle size), int16 positions / int8 normals / uint16 UVs / uint8 joints+weights (KHR_mesh_quantization), animation channels that never leave rest dropped + redundant keys removed + int16 rotations, textures as **WebP** (EXT_texture_webp). No Draco/meshopt/KTX2, so the runtime needs no decoders |

Output: `hikari.glb` ≈ 1.3 MB (20.8k tris incl. sword; base + metal/roughness + normal, 1024² WebP)
and `hikari.lod.glb` ≈ 0.6 MB (9.8k tris; base 1024² + metal/roughness 512²), manifest entries with
`source: 'meshy'` — `tools/blender/build_characters.py` skips those units (pass `--force-procedural`
to rebuild the cage girl instead). The whole build takes under a minute (`--raw-dir` keeps the
unpacked exports so `lib/pack.py` can re-pack other texture sizes without a rebuild).

Runtime (`glbChibi.js` + `figurine.js`): `asset.extras.style === 'textured'` → **look B** of the
owner's lighting study:

- body: `MeshStandardMaterial` with her painted map, metal/roughness and normal maps, plus a tiny
  CPU-built equirectangular studio environment (`studioEnvironment()`, PMREM'd per renderer by
  three.js, intensity `FIGURINE_ENV` 1.0) on her material only. The shader is patched so the hemisphere
  light's green ground bounce reaches her mostly grey (30 % of its colour), and her own
  Khronos-neutral tone curve (`FIGURINE_EXPOSURE` 1.0) runs when the renderer does no tone mapping
  (battle, student viewer). Under the plain battle lights she went grey-green (face, white coat),
  muddy (hair) and brown (gold); at env 0.55 / exposure 0.92 (round 1) she rendered 7–12 % darker
  than her own albedo on hair and skin. Now hair / skin render at ≈ 97 % of the albedo under the
  viewer lights and ≈ 95 % under battle lights (measured: hair 244,151,173 and 241,148,168 vs the
  albedo 252,153,177), without washing out; navy is at or above its albedo. At quality high the
  UnrealBloom threshold (0.95) does not catch her white coat: the neutral curve keeps it ≈ 0.9.
  `tests/models/figurine.test.js` guards this with a CPU estimate of the shading
  (`tests/models/figurineLight.js`) against the albedo under both light rigs.
- outline: inverted hull tinted by her own texture × `#5b3a55` (deep plum on hair and white cloth,
  brown on gold, near-black on navy), pushed along `outlineNormal` (normals averaged over UV-seam
  copies, so the hull never cracks), 0.94 % of her height (1.6 cm on the 1.7 m figure) but at least
  1.7 screen px (× pixel ratio) and at most 2.5× — ≈ 2 px at battle size, ≈ 8 px in the close-up —
  and pushed back 11.8 % of her height in depth (less near the feet so the ground keeps the boots'
  line), so it shows at real silhouette edges instead of leaking through coat, thighs and braid.
- eyes: the face is painted (no face atlas), so the animator's face cells drive **closed-eye states
  drawn in the shader** (`EYE_MODES`): inside each measured eye box (front surface only, never on
  hair-pink texels such as bangs crossing the eye) the texture becomes matte eyelid skin with a
  dark lid line — `blink` (relaxed ‿, on the usual 0.12 s blink timer; also `wink`), `happy` (^ ^, for
  cheer / victory) and `hurt` (> <, for hurt / disabled / dizzy). Each state is its own material
  sharing one program; the instance swaps its body material, like the highlight (the selected
  look is one more program, shared by every eye state).
- props (the sword) use the vertex-colour toon material with a thinner plain outline. `victory` and
  `pickup` fall back to `cheer`. Battle size: height 1.224 (`GAME_HEIGHT`, ≈ 66 px at 1280×720
  default zoom), versus 0.98 for the cage heroes and 0.9 for the students. The first Meshy tests
  shipped at 1.53 (≈ 80 px); the owner found her too big for the map, so she is 20 % smaller. The
  size lives only in `asset.extras` (`height`, and `unitScale` = height / stored height), which the
  runtime reads for the root scale, the outline width and the viewer framing.
- cost: 20.8k / 9.8k tris and 4 draw calls per instance, ≈ 0.7 s to load. Fine for one hero; with
  ~3× the screen area of a cage girl plus PBR + environment map, 20 instances cost ≈ 3.6× (full) /
  2.7× (LOD) the frame time of 20 Aoi in SwiftShader. Before moving more of the roster to this
  pipeline, consider medium (LOD, no normal map) as the default on touch devices or a DPR cap.

### Noa (art wave, Oct 2026)

Her art-wave Meshy model, imported with the same pipeline and her own profile (scratch build, no Meshy job):
`noa.glb` 1.23 MB (20.0k tris) / `noa.lod.glb` 0.57 MB (9.0k tris), one 25-joint skeleton, clips `idle`, `walk`,
`attack_smash` (her "ward push"), `cheer`, `hurt`; Hikari's battle height (1.224). Her folded Ward Shield is part of
the body mesh on `forearm_L` (every clip keeps that wrist straight), so she has no prop and no `sword` node
(`glb.test.js` requires a sword only for `weaponKind: 'slash'`). Every clip carries a 13° chin-up so her eyes clear
her straight bangs at the 48° camera. `asset.extras.eyes.hairGuard` (`{ hue: [deg, deg], sat, val }` in linear-RGB
HSV) tells the closed-eye shader which texels are her honey-brown bangs (kept as painted); without it the shader
keeps Hikari's pink-hair rule, so Hikari is unchanged (`figGuard` uniform in `figurine.js`). Known: no secondary
motion on her buns or skirt (humanoid rig); thin hull slivers by the loafers at ≥ 4× zoom, as on Hikari's boots.

Proportions (owner's pick, Oct 20: variant A, "bigger head only"): her head (face, hair, buns, clips, painted eyes) is
17 % bigger, scaled from her chin, so it is 44.0 % of her height (Hikari 44.7 %, before 40.1 %); only the top of the
neck stretches to meet it. The skeleton, skin weights, inverse binds, all five clips, UVs, textures and materials
are byte-identical to the import before; only positions, the normals around the neck and `extras` (`unitScale`
1.44 → 1.34806, the moved eye boxes, `proportions: 'noa-A'`) change. She keeps the 1.224 battle height, so her body
is about 6 % smaller on screen. Files 1,227,116 / 570,536 B (+28 B each). The step is `tools/meshy/lib/proportions.py`
(presets `noa-A`, `noa-B`): `--proportions noa-A` on `build_meshy_chibi.py`, or `tools/meshy/reproportion.py` on a
build's kept `--raw-dir` exports, which gives these files byte for byte.

### Hana (art wave, Oct 2026)

Same pipeline with her own profile: `hana.glb` 1.24 MB (20.5k tris incl. bow) / `hana.lod.glb` 0.57 MB (9.5k tris),
a 30-joint skeleton (the renamed humanoid plus `root`, `braid1..3`, `kaze` and `bow_nock`), clips `idle`, `walk`,
`attack_bow`, `cheer`, `hurt`, Hikari's battle height, `weaponKind 'bow'`. Her folding compound bow (468 tris,
vertex colours, built locally) is skinned to `hand_L`; the string also rides `bow_nock`, which the attack draws back
to her right fist, so the string bends into a V and snaps straight on release. Kaze, her drone falcon, was modelled
on her right shoulder; since Oct 21 he is taken off her (see "Companions taken off their girls" below) and the `kaze`
bone stays in the skeleton unweighted. Every clip carries a 16° chin-up; her
`extras.eyes.hairGuard` keeps her auburn bangs painted during a blink. Not on the chibi: the quiver and archery case
from her portrait. A separate circling Kaze (the falconer mechanic) would need his own model.

### Ruri (art wave, Oct 2026)

Same pipeline with her own profile (her art-wave model's first full pass; scratch build, no Meshy job):
`ruri.glb` 1.35 MB (20.0k tris) / `ruri.lod.glb` 0.62 MB (9.0k tris), about 2.5 % over Hikari's sizes
(`--webp-quality 88` would bring both under). One 28-joint skeleton: the renamed humanoid plus `root`, `kon`,
`hair_back` and `hair_tip`. Clips `idle`, `walk`, `attack_book` (taps the grimoire, points, Kon hops), `cheer`,
`hurt`; Hikari's battle height, `weaponKind 'book'`, 2 draw calls per instance (no separate prop mesh). Kon, her
holo fox, was modelled on her left shoulder; since Oct 21 he is taken off her (below) and the `kon` bone stays in the
skeleton unweighted, so the clips are unchanged; the grimoire is skinned to the
hips (0.7) and her left thigh (0.3), so it stays at her hip. Meshy's rig was repaired: the right wrist and knee
joints mirror the left ones, the long back hair follows its own `hair_back` → `hair_tip` chain instead of the right
arm, the blazer follows the spine and the skirt blends hips and thighs. Every clip carries a 14° chin-up. Her eye
patch normals are refitted to a mirror-symmetric face surface (`fit_eye_normals`, so both closed lids shade alike),
and her `extras.eyes.hairGuard` (`{ hue: [223, 245], sat 0.85, val 0.06 }`, measured by hand: her navy iris sits
just below her hair's hue) keeps her navy bangs painted during a blink. Known: her left arm stays near rest in most
clips (it holds the grimoire); no secondary motion on the blazer or skirt.

### Companions taken off their girls (Oct 21)

Kon (Ruri), Kaze (Hana) and Yoriko's doll are separate figures now, never part of their girl:

* **Ruri and Hana** (`tools/meshy/split_companion.py`, bpy 4.2): works on the shipped packed GLB, so everything that is
  not the companion stays byte for byte (skeleton incl. the now unweighted `kon` / `kaze` bone, clips, textures,
  materials, `asset.extras`, every other vertex). It removes every face skinned to the companion's bone, his loose
  fragments and the pale paw / tail-root bits fused into her (standing off her mirrored other side), then closes each
  hole with a disc (rim = her own vertices, weights and normals, so nothing cracks when she moves; inner points relaxed
  and eased onto her mirrored other side) textured with one even texel of the cloth or hair round it (Ruri: her
  armband's navy along its stretch of the arm). `python3 tools/meshy/split_companion.py --glb <file> --bone kon`
  (`--bone kaze --mesh hana` for Hana); then the manifest sizes. Sizes: `ruri.glb` 1,327,140 B (19.5k tris) / LOD
  608,796 B, `hana.glb` 1,206,276 B (19.7k tris) / LOD 556,844 B. Close up, Ruri's outer upper arm under the armband
  is a plain white cap with a small flat navy piece of band (the armband was fused with Kon's paws there), and Hana has a
  small flat skin-coloured cap between hair and collar where Kaze's body met them; neither shows at battle size. The
  Meshy versions of the girls are due to be redone anyway.
* **Yoriko**: `marionette` keeps the control bar (and the glove's thread node); the doll and its four threads are gone.
* `EXTRA_PARTS` no longer lists `falcon` (Hana) or `foxFamiliar` (Ruri), so a `--force-procedural` rebuild matches.

## Judging quality

Always judge with three.js screenshots (Blender's EEVEE needs a GPU): round head, big eyes placed low,
broad hair sections with pointed tips (never thin jagged strands), hair fully covering the cranium from
every angle, nothing poking through, outline thin, halo readable on light backgrounds, poses without
stretching (`view=states`).

---

# Enemy models V2 — one rigged GLB per family

The 74 monsters of the bestiary (`src/data/enemies.js`, 12 families) share the chibi method
(quad cages → Catmull-Clark subsurf, creased tips, painted faces, toon + inverted-hull outline) but
ship as **one GLB per family** in `public/models/enemies/` (`tools/blender/enemies/`, same `bpy` 4.2):

```
python3 tools/blender/enemies/build_enemies.py              # all 12 families (~15 s)
python3 tools/blender/enemies/build_enemies.py orc dragon   # just these
python3 tools/blender/enemies/build_enemies.py slime --blend /tmp/slime.blend --no-anim
```

| file | content | budget |
|---|---|---|
| `<family>.glb` | the rigged base body + every prop / variant piece the family's defs use, clips `move idle hit death special` | ≤ 320 KB each, **≤ 2.5 MB for all 12** (currently ≈ 2.2 MB) |
| `manifest.json` | `{ family: { file, size, vertices, animations, props, variants, height, unitScale } }` | |

## Construction (`tools/blender/enemies/`)

| module | content |
|---|---|
| `dump_enemies.mjs` | dumps `ENEMIES` / `FAMILIES` to JSON (node) so the build only generates the props and variants that are actually used |
| `parts.py` | cage helpers on top of `lib/mesh.py` (`blob`, `box`, `tube`, `cone`, `lathe`, `plate`, `ring`, `gloss_on`, `head` with a planar face-UV window) and the **tint roles** painted into the vertex-colour alpha: `main` (× `def.color`), `accent` (× `def.accent`), `fixed` (literal colour: teeth, metal, gold) |
| `bodies.py` | the chunky Nendoroid **biped** (head ≈ body, stubby limbs, mitten hands, big feet) and the **quadruped**, plus ears (pointy / round / tall), snout, tusks, hair tufts |
| `props.py` | the whole `EnemyDef.model.props` vocabulary as separate cage parts tagged `prop:<name>` (helmet, hood, crown, tiara, horns, mask, goggles, scarf, cape, mane, shield, towerShield, club, axe, spear, sword, staff, lantern, bomb, smokePot, backpack, wrench, drum, fan, mirror, chains, candle, gears, chimney, cannon, crystals, leaves, flower, thorns, moss, mushroom, bubble, pearl, sparkle, ember, glider, bones…) placed on the family's anchors (head, top, back, hands, chest, neck); a family may build its own version and mark it `done` |
| `families/<family>.py` | the family body + variants: slime (fat jelly drop; rainbow / chest-mimic / knight / royal), goblin (scrawny runner; machine = copper boiler mech with a pilot), orc (belly brute), ghost (lantern sheet), ghoul, oni (horned festival demon), lizardfolk, construct (automaton / cogling / beetle / colossus), beast (quadruped wolf / boar / bear), fae (winged sprite), plant (sprout / pod / thornroot / mossling / treant on root legs), dragon (winged quadruped, matriarch) |
| `efaces.py` | PIL face **atlas** per family, 3×2 cells `idle blink hit angry dead cast` (glossy / sharp / angry / glow / visor / dot eyes, fangs, blush) |
| `erig.py` | archetype armatures: blob `root body top`, biped `root hips chest head arm_L/R leg_L/R`, quad `root body head leg_FL/FR/BL/BR tail_n`, plus wing bones |
| `eanim.py` | clips authored with the chibi `Poser`: move styles `hop waddle run stomp shamble float flutter gallop fly sway`, hits `squash recoil`, deaths `splat topple poof collapse wilt`, specials `cast siphon blink roar`; each family picks its set in `ctx['clips']` |
| `pack.py` | KHR_mesh_quantization packing: int16 positions, uint8 RGBA colours (alpha = tint role), uint16 UVs (face parts only), byte joints / weights, 16-bit indices, **no normals** (the runtime recomputes them from the smooth shells), identical accessors shared, exporter float noise trimmed |

Mesh objects are named `<vis>|<group>|<material>` (`base`, `prop-<name>`, `var-<variant>`; materials `body` / `glow`).
Whole families are stored at **half scale** (`asset.extras.unitScale` = 2); `extras` also carry `height`,
`faceCells`, `faceGrid`, `faceCorner`, `translucent` (slimes / ghosts) and the `variants` hide table
(e.g. `machine` hides `head torso arms legs`).

## Runtime (`src/models/glbEnemy.js`, `src/models/enemies.js`)

* `preloadEnemies(families?)` loads family GLBs (4 at a time); `buildEnemy(def)` is synchronous: a loaded
  family gives a GLB instance at once, otherwise the V1 procedural monster is returned as a placeholder and
  upgraded in place when the file arrives (node / offline stay procedural).
* An instance = the pieces `def.model` asks for (base groups minus the variant's hide list + `prop:*` +
  `var:*`) merged into **one skinned mesh per material** (body, glow) + one outline, bound to a
  `SkeletonUtils` clone of the family skeleton (merged geometry cached per family|variant|props). Tint
  roles are resolved in the shader from `def.color` / `def.accent`; the face atlas is blended over the
  tinted skin. Draw calls per monster: body + outline (+ glow).
* CONTRACT §7 hooks keep working (`animate`, `hitFlash`, `setVeiled`, `setBarrier`, `setPhasing`,
  `setStatus`) plus `playDeath()` → seconds, `playSpecial()`, `setCasting(bool)`, `setExpression(cell)`.
  The battle renderer plays `death` before disposing a killed monster, loops `special` while an oni field
  is projected, and fires `special` on blink wind-ups and boss phase changes.

## Judging quality

`/previews/enemies-v2.html` — `view=sheet` (every monster on one contact sheet; shoot it at ≥ 1600×1100
with `&still=1&shadows=0`), `view=lineup&page=1..4` (three families per page at 1280×720), `family&fam=`,
`turn&id=`, `states&id=` (idle / move / hit / death / special / cast), `hooks`, `game`, `viewer`.
`npx vitest run tests/models` checks every family GLB (clips, rig, materials, atlas, piece names, size
budget) and that every EnemyDef resolves to a built family with its variant and props.

---

# Companions — Kon, Kaze and the drone marionette

The three companions are separate figures now, built by our own cage pipeline (no generator, no outside art):
Kon (Ruri's little holographic white fox, projected by her tablet to the lane edge), Kaze (the white falcon drone
Hana built in the robotics lab) and Yoriko's drone marionette (a tiny doll in a school uniform on three glowing
threads). They ship in `public/models/companions/`; the girls' own figures no longer carry them
(`tools/meshy/split_companion.py`, see above) and the battle draws them as display actors beside their girls (see
"Runtime" below).

```
python3 tools/blender/companions/build_companions.py              # all three, full + LOD, manifest updated
python3 tools/blender/companions/build_companions.py kaze          # just one
python3 tools/blender/companions/build_companions.py doll --blend /tmp/doll.blend --no-lod   # inspect in Blender
```

Each figure builds in under a second. Like the girls, rebuild one companion per process if you want byte-identical
files (object names count up within a process). Look at them with `previews/companions.html`: `?view=turn&id=kon`
(front, 3/4, side, back), `?view=clip&id=kaze&clip=attack&frames=6` (one clip as a frame strip),
`?view=lineup&id=doll[&cam=battle]` (next to the girl's shipped GLB at true scale, then at the home offset, from the
front or the 48° battle camera), `?view=measure` (logs the girls' anchor bones as JSON), `&lod=1` for the LOD files.
The preview draws them with the girls' runtime look (`instantiateCharacter`: toon ramp, inverted-hull outline, unlit glow).

## How they are built (`tools/blender/companions/build_companions.py`)

One file on top of `tools/blender/lib`: cage blobs / tubes / lathes with Catmull-Clark (`mesh.py`), creased tips, a
painted face atlas on a head with the girls' planar front projection (only polygons that face the front take the face,
so the eyes never wrap round a hairless head), an armature (`rig.py`), clips keyed with the girls' `Poser` (`anim.py`),
the girls' materials and GLB post-processing (`export.py`, KHR_mesh_quantization in `optimize.py`). Mirrored parts
get their bone groups renamed `_L` → `_R` in place (`lib.mesh.mirror_x` keeps the copied mesh's `_L` groups next to the
new `_R` ones in Blender 4, so a mirrored wing would follow both bones half and half).

| | Kon | Kaze | doll |
|---|---|---|---|
| look | white chibi fox, big glossy cyan-blue eyes, pale-blue tint to the tail tip and ear tips, glowing inner ears, collar + tag, paw cuffs, tail tip and a hex projector pad on the ground (all glow) | white shell with grey panels and dark primaries, big teal eyes, gold beak and talons, an olive neck band (Hana's jacket), glowing sensors, chest core and wing stripes | lilac bob with a blunt fringe and a glowing clip, white sailor top with a lilac collar and a glowing bow, navy pleated skirt, white knee socks, brown shoes, glowing wrist joints, three glowing threads |
| palette from | Ruri (accent `#89c5fc`, tablet glow) | Hana (olive `#798d5b`, gold) + the portrait's mint visor | Yoriko's override palette (`#b49ad0` hair, `#9a72d0` eyes, orchid glow) |
| face cells | idle, blink, attack, happy (2 × 2 atlas, 128 px cells; LOD 64 px) | same | same, girl-style eyes and mouth |
| bones | root, base (pad), hips, chest, head, ear, fleg, hleg (L/R), tail1–3 | root, body, head, wing + wingtip (L/R), tail, leg (L/R) | root, hips, chest, head, arm (L/R), leg (L/R), bar (thread tops) |
| idle | sits, breathes, looks about, ear flick, tail swish (2 s loop) | perches with folded wings, looks round, tail flick, wing ruffle (2 s) | dangles and bobs on the threads, legs swinging (2 s) |
| move | bounding run (0.5 s loop) | flapping flight (0.5 s loop) | floats forward, legs trailing (1 s loop) |
| attack | crouch, pounce, land, a small yip, hop back (0.83 s) | rise, tucked dive, talons forward with a flare, climb back (0.83 s) | pulled back, dash with a chop and a kick, swings home; the threads stretch to the bar (0.67 s) |
| appear | the pad lights, a thin projected beam pops to size, yip (0.5 s) | flies in from above, flares, lands, folds the wings (0.67 s) | drops in on the threads, a little bounce (0.5 s) |

Kaze's wings are modelled spread (rest pose) and every perched key folds them along his sides, trailing edge down.
He is modelled at 0.146 m and stored 1.35× (0.197 m) so he still reads beside Hana's big chibi head; the builder's
per-figure `scale` scales mesh, bones and clip offsets together. Kon's hologram feel is colour + glow parts; the GLB also
carries `asset.extras.holo = { opacity: 0.88 }` as a hint. The preview draws body and face at that opacity after a
depth-only pre-pass (polygon offset 1 / 2), so only the front surface blends; without the pre-pass the legs show
through the chest.

## The contract (what a Meshy version must keep)

| | |
|---|---|
| files | `public/models/companions/<id>.glb` + `<id>.lod.glb`, ids `kon`, `kaze`, `doll` |
| clips | exactly `idle`, `move` (loop), `attack`, `appear` (play once); any extra clip is ignored |
| space | glTF Y up, facing +Z, feet / paws / talons on y = 0 at the origin (the doll: its shoe soles), metres at game scale × `asset.extras.unitScale` (1 for the Blender figures) |
| extras | `companion`, `owner`, `height` (standing height at game scale, threads and pad excluded), `unitScale`, `clips`, `home`; Blender figures add `faceCells` / `faceGrid` (cell UVs in [0, 1] of one cell, like the girls), the doll `threads = { bone: 'bar', bones }` |
| manifest | `{ <id>: { file, lod, bytes, lodBytes, vertices, lodVertices, clips, height, owner, home: { offset, follow, note }, source, battleScale?, pageScale? } }`; `battleScale` (optional, default 1) sizes the figure in battle only, over its girl's scale, around its origin; `pageScale` (optional, default 1) does the same in the figure viewer (student page). Kon uses 2.4 for both (owner: he was too tiny). The builder keeps it across rebuilds |
| home | `offset` = where the companion's origin sits relative to its girl's root in her bind pose (glTF axes at game scale: +X her left, +Y up, +Z her front); `follow` = her bone whose motion it rides (keep the offset from that bone's bind position), `null` = stays on the ground |
| budget | ≤ 150 KB full, ≤ 80 KB LOD (`tests/models/companions.test.js`) |

| id | owner | home offset | follow | note |
|---|---|---|---|---|
| kon | ruri | [0.24, 0, 0.18] | — | at her feet, front-left of her |
| kaze | hana | [0.235, 0.56, 0.035] | `shoulder_L` | on her left shoulder, just in front of the braid (her bow and braid hang on that side) |
| doll | yoriko | [0.264, 0.192, 0.125] | `hand_L` | hangs in front of her raised left hand; the thread tops (bone `bar`, 0.50 m above the doll's origin) meet her control bar. The runtime may set `bar`'s world position to her bar every frame so the threads stay attached while the doll dashes |

The offsets were measured on the shipped GLBs with `?view=measure` (Ruri's feet, Hana's shoulder and her baked
Kaze bone mirrored, Yoriko's `hand_L` in idle, where her pinned bar arm is held up).

**A Meshy version replaces one figure without code changes:** export its two GLBs under the same names with the four
clips, the origin and facing above, `asset.extras.height` / `unitScale` / `companion` / `owner` / `home` copied from
the manifest entry (or re-measured), then set its manifest entry's `file`, `lod`, `bytes`, `lodBytes`, `clips`, `height`
and `source: 'meshy'`. The builder keeps entries marked `meshy` (it skips them), and the test then stops requiring the
Blender material set (a textured figure brings its own). The doll's `bar` bone is optional for a Meshy doll: without it the
runtime draws the threads itself.

## Sizes (Oct 21)

| | full | LOD | height | at battle zoom (Hikari 66 px) |
|---|---|---|---|---|
| kon | 117,600 B (2,194 verts) | 59,196 B (695 verts) | 0.174 m (knee height of a 0.9 m girl) | ≈ 9 px |
| kaze | 105,636 B (1,918 verts) | 52,044 B (557 verts) | 0.197 m (× 1.3 `battleScale` in battle) | ≈ 14 px |
| doll | 137,940 B (3,018 verts) | 58,344 B (936 verts) | 0.304 m (a third of Yoriko) | ≈ 16 px |

Known: at battle size Kon and Kaze are a few pixels tall, so their faces are big dark eyes and little else (the full files
take over from the LOD ones when the battle is zoomed in to 2× or more on quality high); Kaze on Hana's left shoulder
sits under her chibi head, between braid and bow, so part of him hides from some angles.

## Runtime (display only)

Nothing below reads anything but the sim's towers and its drained events, and nothing writes the sim, the save or a
co-op command: the sim id does not change.

* `src/models/companions.js`: the manifest (`loadCompanionManifest`, `companionOf(unitId)` by `owner`), loading through
  glbChibi's cache under the key `../companions/<id>` (`loadCompanion` / `getCompanion`), `buildCompanion(asset)` =
  `instantiateCharacter` (the girls' toon ramp, inverted-hull outline, mixer and face cells; the animator plays `move` as
  a loop and `appear` once through `userData.playClip`). Kon's `extras.holo` gets body + face at that opacity with a
  pale-blue emissive lift after a depth-only pre-pass (`renderOrder` 1 / 2), as in the preview. `HomeAnchor` puts the
  figure at `home.offset` in the girl's group space and keeps the offset from her `follow` bone's idle (t = 0) position
  (`boneAtIdle`, measured once per girl asset and cached), so Kaze rides her shoulder and the doll her raised hand;
  without that bone (procedural placeholder) the offset is used as is. Because the offset is in her group space, her
  battle scale (towers 1.22, heroes 1.36, × her pop-in) and her height (a Meshy girl is 1.224 m against a Blender girl's
  0.9–0.98 m) carry over.
* `src/render/companions.js` (`Companions`, made by `BattleRenderer`): one actor per sim tower whose unit has a companion
  (co-op partners' girls too), made once her view and the file are there, `appear` on creation, gone when she leaves the
  sim (sold, a new battle); restore and replays just recreate them. `handle(ev)` observes `attack` and `ult` before the
  attack FX consume them; `update(dt, zoom)` runs after `actors.sync`. Off at quality low (rosterFx's procedural fox is
  the fallback, as it is while Kon's file loads; an error in the layer switches it off for that battle with one
  `[companions] disabled` warning). LOD files by default, full ones on quality high at zoom ≥ 2 (back at
  ≤ 1.7). Probe: `renderer.companionsProbe()`.
* Rules (`src/render/companionLogic.js`, unit-tested in `tests/render/companions.test.js`): **Kon** sits by Ruri while
  her relay origin is her own spot (within 0.3 tiles), else runs along the ground (2.4 tiles/s, after his 0.5 s appear)
  to `t.ox / t.oy` and sits there, runs to a new spot when it moves (a `relay` event) and back when it goes away; Ruri's
  bolts play his attack only while he sits at the spot, and leave his head where he is drawn (`attackFx/styles/ruri.js`);
  rosterFx hides its fox and runs the tether to him. **Kaze** perches on `shoulder_L`; on Hana's attacks he swoops to the
  target and back (0.95 s, an arc 0.45 tiles high, following the enemy), one swoop at a time, attacks while he is out are
  skipped; Hana's hawk sprite dive is only drawn without him. **The doll** hangs in front of Yoriko's raised hand; on her
  needles and on Dream Detour (the `ult` centre) it dashes at the target and back (0.67 s, at most 1.3 tiles, stopping
  0.35 short), its `bar` bone held where the thread tops sit at home so the glowing threads stay tied to her control bar.
* Figure viewers: `buildChibi(unit, { companion: true })` adds her companion in its home pose (idle, riding her bone)
  beside the GLB figure; the student page's 3D view uses it. (The lobby is a painted scene with no 3D figure.)
* Cost: three skinned figures at most per player (≤ 936 vertices each at LOD, + outlines), no per-frame allocations
  besides Map iterators; Kon's holo adds one depth-only draw per mesh.
* e2e: `node e2e/companions.mjs [--shots dir]` (844×390: the three figures, Kon's run, Kaze's swoop and return, the
  doll's dash, removal on sell, quality low, the student pages; frame strips with the battle paused and the renderer
  stepped by hand).
