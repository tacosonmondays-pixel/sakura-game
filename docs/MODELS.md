# Chibi models V2 — pipeline notes

The academy girls are built by a programmatic Blender pipeline (`tools/blender/`, Blender 4.2 as the
`bpy` python module) and shipped as one GLB per unit in `public/models/characters/`. The method is the
one from the jaeysart "sitting chibi" tutorial (its example images are third-party, so they stay
on the owner's PC in the git-ignored `docs/reference/thirdparty/`): a handful of
quad **cages** that get a Catmull-Clark **Subdivision Surface**, creased edges where tips must stay
sharp, and a **painted face texture** instead of face geometry.

```
python3 tools/blender/build_characters.py              # all 19 units, full + LOD
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
| `face.py` | PIL face **atlas** (3×3 cells: idle, blink, attack, happy, hurt, dizzy, wink, shy, surprised): big glossy eyes with dark upper-lid stroke, iris gradient, lid shadow, two highlights, lashes, thin brows in the hair colour, tiny mouth, blush; styles `round/sharp/sleepy/sparkle/closed`, expressions `smile/smug/calm/determined/shy/cheerful`. 256² cells for girls, 341² for heroes; quantised to a palette PNG (≈50–70 KB). Opt-in look keys: `softFace` (thinner mid-tone brows, gentler upper lids), `brows` (brow shape of the resting cells) |
| `hair.py` | cap shell over the cranium (shrink-wrapped onto the real head mesh with a fixed gap, then thickened outwards, inner shell in `hairShade`), **bangs** (`straight/swept/split/hime/messy`), side locks, back curtains, tails and buns per `hairStyle` (`long/hime/wavy/bob/short/twintails/ponytail/side/braid/buns`). Every lock is one broad tapered tube with a creased pointed tip. Tails / long back hair get their own bones (`tail_L`, `tail_R`, `hair_back`). Added for the temporary chibis: styles `bunsBob` (Iroha), `sideBraid` (Ena, a puffed side braid on `tail_L`), bangs `blunt`; opt-in look keys `bangRaise` (bang tips N° higher), twin-tail `tailAz tailEl tailLen tailR tailOut tailCurl tailDroop tieT tieLen`, ponytail `ponyS ponyAz ponyEl ponyLen ponyR ponyOut ponyCurl ponyDroop sideLen sideFlare sideWave`, wavy `hairLen`; tail ties take `palette.tie` (else the accent) |
| `outfit.py` | colour plan per `look.outfit` (`spec()`) + extra cages: sailor collar, ribbons/bows, pleated skirts, cuffs, puff/wide sleeves, belts, breastplate + pauldrons + cape (armor), hood, apron, obi, pockets…; the temporary chibis added `trackJacket` (Fuu), `sailorCardigan` (Iroha), `blazerCardigan` (Ena, tartan skirt + open cardigan hem), `staffTrack` (Kanna), `stageCoat` (Yoriko), `flightJacket` (Seiran) and an optional hem `stripe` on the shared `skirt()` |
| `accessory.py` | ribbon, bunny/cat/fox ears, hairpin, beret, witch hat (raises the halo), horns (default oni horns; `ctx.horn_shape` `curl` = ram horns, `dragon` = long swept-back horns), flower, goggles, hood, headband, crown, **cap** (peaked captain's cap: accent crown, dark band and visor, gold badge; raises the halo), `leafClip` (Fuu), `mirrorOrnament` (Iroha), `rose` (Ena), `catHeadset` (Yoriko), horn shapes `oni` (Kanna) and `crescent` (Seiran, `palette.horn`) — all placed above the hair surface (`HAIR_TOP`) |
| `weapon.py` | one cage model per `look.weapon`, weighted to `hand_R` (bow/tome/shield to `hand_L`, mallet in both hands); `kind_of()` maps weapons to attack kinds. Roster merge added `mic` (cast), `shield` (smash), `mirror` (cast, glowing glass on the halo material), `spear` (thrust), `mallet` (taiko bachi, smash), `puppet` (control bar + strings + tiny marionette, cast), `cards` (fan of four cards, throw); the temporary chibis added `turbineFan` (sweep), `roseCards` (throw), `bachi` (smash), `marionette` (cast, left hand) and `stormSpear` (thrust) |
| `extras.py` | per-unit extra parts from the tools-only tables `EXTRA_PARTS` / `HORN_SHAPE` in `build_characters.py` (keyed by unit id, no schema change): `foxTail` (Luna), `falcon` + `quiver` (Hana), `foxFamiliar` (Ruri), `taikoStand` (Kanna's taiko on a stand, weighted to `root`; the old hip `taikoDrum` stays in the library), `tailBows` (Fuu), `cardDealer` (Ena), `flightHeadset` (Seiran), `mortarTube` (Tsubaki), `monocle` (Kohaku). They are ordinary vertex-coloured cages joined into the **body** mesh and weighted to hips/chest/head, so every GLB keeps exactly three primitives |
| `halo.py` | ring/star/petal/gear/moon/flame/wave/crown/snow/bolt/leaf/eye/crescent (the moon outline with its face normals recalculated), emissive `halo` material, bone `halo` |
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
(`STANDIN_UNITS`; Noa and Hana have their imported Meshy figures since the art wave, see "Imported Meshy figures"; Fuu and Iroha have temporary Blender chibis, see "Temporary Blender chibis") are drawn by
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
  the 2D card doll fallback and the wiki text (Fuu's data still says mint hair, for example).
* **Face at 48°.** Every clip carries a chin-up (`chinUp`, 12–22°), as Hikari's clips do, and the bangs end higher
  (`bangRaise`), so the eyes clear the bangs under the battle camera.
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
| Fuu | 478,116 / 238,008 B (10,324 / 3,647 verts) | 50 px | milk-chocolate twintails set high with mint ribbon bows, a gold leaf clip, an open mint track jacket with gold piping over a white sailor blouse, a mint pleated skirt, pine-green leggings, white high-tops, a big folding fan with three glowing turbines; chin-up 12° | mid-sweep the fan turns edge-on to the camera |
| Iroha | 469,720 / 221,356 B (10,192 / 3,284 verts) | 56 px | a plum-black bob with two high buns and a silver mirror ornament on the left one, a blunt fringe, a charcoal sailor top and plum scarf under a long open plum cardigan, black tights, loafers, her hand mirror; round lilac eyes; chin-up 14° (neck / head 60 / 40, `chinSplit`) | from the front her brows read a little serious |

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

### Hana (art wave, Oct 2026)

Same pipeline with her own profile: `hana.glb` 1.24 MB (20.5k tris incl. bow) / `hana.lod.glb` 0.57 MB (9.5k tris),
a 30-joint skeleton (the renamed humanoid plus `root`, `braid1..3`, `kaze` and `bow_nock`), clips `idle`, `walk`,
`attack_bow`, `cheer`, `hurt`, Hikari's battle height, `weaponKind 'bow'`. Her folding compound bow (468 tris,
vertex colours, built locally) is skinned to `hand_L`; the string also rides `bow_nock`, which the attack draws back
to her right fist, so the string bends into a V and snaps straight on release. Kaze, her drone falcon, is part of the
body mesh on her right shoulder and bobs on his own `kaze` bone. Every clip carries a 16° chin-up; her
`extras.eyes.hairGuard` keeps her auburn bangs painted during a blink. Not on the chibi: the quiver and archery case
from her portrait. A separate circling Kaze (the falconer mechanic) would need his own model.

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
