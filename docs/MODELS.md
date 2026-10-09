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
| `face.py` | PIL face **atlas** (3×3 cells: idle, blink, attack, happy, hurt, dizzy, wink, shy, surprised): big glossy eyes with dark upper-lid stroke, iris gradient, lid shadow, two highlights, lashes, thin brows in the hair colour, tiny mouth, blush; styles `round/sharp/sleepy/sparkle/closed`, expressions `smile/smug/calm/determined/shy/cheerful`. 256² cells for girls, 341² for heroes; quantised to a palette PNG (≈50–70 KB) |
| `hair.py` | cap shell over the cranium (shrink-wrapped onto the real head mesh with a fixed gap, then thickened outwards, inner shell in `hairShade`), **bangs** (`straight/swept/split/hime/messy`), side locks, back curtains, tails and buns per `hairStyle` (`long/hime/wavy/bob/short/twintails/ponytail/side/braid/buns`). Every lock is one broad tapered tube with a creased pointed tip. Tails / long back hair get their own bones (`tail_L`, `tail_R`, `hair_back`) |
| `outfit.py` | colour plan per `look.outfit` (`spec()`) + extra cages: sailor collar, ribbons/bows, pleated skirts, cuffs, puff/wide sleeves, belts, breastplate + pauldrons + cape (armor), hood, apron, obi, pockets… |
| `accessory.py` | ribbon, bunny/cat/fox ears, hairpin, beret, witch hat (raises the halo), horns, flower, goggles, hood, headband, crown — all placed above the hair surface (`HAIR_TOP`) |
| `weapon.py` | one cage model per `look.weapon`, weighted to `hand_R` (bow/tome to `hand_L`); `kind_of()` maps weapons to attack kinds |
| `halo.py` | ring/star/petal/gear/moon/flame/wave/crown/snow/bolt/leaf/eye, emissive `halo` material, bone `halo` |
| `rig.py` | armature: `root, hips, spine, chest, neck, head, halo, shoulder/upper_arm/forearm/hand _L/_R, thigh/shin/foot _L/_R` (+ hair bones). No dots in bone names so three.js keeps them verbatim in track names |
| `anim.py` | actions authored as a few keyframes at 24 fps in armature space (`Poser.key(frame, {bone: (pitch, roll, yaw)})`), bezier → exported as CUBICSPLINE. Clips: `idle` (personality per expression, breathing, halo float), `walk`, `attack_<kind>` with anticipation → strike → recovery (`slash, thrust, bow, rifle, cannon, cast, throw, smash, sweep`), `cheer`, `victory` (weapon-specific pose), `hurt`, `pickup` (wriggle) |
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
| 2 | `lib/bake.py` | Cycles CPU selected-to-active bakes onto the new UVs: base colour (baked at 2048², shipped at 1024²: the downsample gives cleaner edges than a direct 1024 bake, and the 2× face density keeps the eyes crisp in the student close-up), metal/roughness (1024², LOD 512²: the gold trims, stars and buttons are metallic and catch the environment map; without it the gold reads brown) and, full detail only, tangent-space normals from the 93k surface + Meshy's own normal map (1024²: keeps the braid, bang strands and coat embossing that decimation flattens; the LOD skips it, invisible at battle size) |
| 3 | `lib/rig_names.py`, `lib/retarget.py` | readable bone names (`root, hips, spine, chest, neck, head, upper_arm_R, …, hair_back1, coat_L1, bangs1`), then the library clips are retargeted by world-space rotation deltas from each rest pose (both rigs are Meshy A-poses) |
| 4 | `lib/sword.py`, `lib/clips_hikari.py`, `lib/posekit.py` | the approved sheet's jewelled sword (crystal blade with white edges, gold star crossguard with a teal gem, magenta gem + grip, teal pommel; 794 tris, vertex colours) parented to `hand_R` with the fingers curled round the grip; clips `idle` 1.5 s (library idle + two knee bounces), `walk` 0.97 s (library walk), `attack_slash` 0.6 s, `cheer` 1.2 s (arms up + hop), `hurt` 0.4 s. The sword arm and the legs are 2-bone IK so the blade path is designed: wind-up beside her right shoulder, one diagonal cut across the front below the collar — it never crosses her face, from the front or from the battle camera. Every clip carries a small chin-up / lean back (neck −7°, spine −3°) so the eyes stay readable under her long bangs from the 48° battle camera |
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
  three.js, intensity 0.55) on her material only. The shader is patched so the hemisphere light's
  green ground bounce reaches her mostly grey (30 % of its colour), and her own Khronos-neutral tone
  curve (exposure 0.92) runs when the renderer does no tone mapping (battle, student viewer). Under
  the plain battle lights she went grey-green (face, white coat), muddy (hair) and brown (gold).
- outline: inverted hull tinted by her own texture × `#5b3a55` (deep plum on hair and white cloth,
  brown on gold, near-black on navy), pushed along `outlineNormal` (normals averaged over UV-seam
  copies, so the hull never cracks), 0.94 % of her height (1.6 cm on the 1.7 m figure) but at least
  1.7 screen px (× pixel ratio) and at most 2.5× — ≈ 2 px at battle size, ≈ 8 px in the close-up —
  and pushed back 11.8 % of her height in depth (less near the feet so the ground keeps the boots'
  line), so it shows at real silhouette edges instead of leaking through coat, thighs and braid.
- props (the sword) use the vertex-colour toon material with a thinner plain outline. No face atlas
  (the face is painted), so expressions/blinks are a no-op; `victory` and `pickup` fall back to
  `cheer`. Battle size: height 1.53 (≈ 83 px at 1280×720 default zoom, the size the owner approved),
  versus 0.98 for the cage heroes.

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
